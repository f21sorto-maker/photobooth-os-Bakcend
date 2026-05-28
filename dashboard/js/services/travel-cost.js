/**
 * Travel-cost service
 * ---------------------------------------------------------------------------
 * Calculates the cost of driving the company vehicle (2024 Subaru Forester
 * Wilderness, 25 MPG combined, 87-octane regular) from the business base
 * address to a customer's event address.
 *
 * Live gas-price source: U.S. Energy Information Administration (EIA), proxied
 * through the n8n workflow `update-gas-price.json` and cached in localStorage
 * for 3 hours (matches the n8n refresh cadence so we don't hammer n8n).
 *
 *   fuelCost   = roundTripMiles / VEHICLE.mpgCombined * gasPricePerGallon
 *   wearCost   = roundTripMiles * WEAR_TEAR_PER_MILE
 *   travelCost = fuelCost + wearCost           ← billed to the customer
 */

import { CONFIG } from '../config.js';
import { calculateRouteDistance } from '../api.js';

const STORAGE_KEY = 'pb_os_gas_price_v1';

/**
 * Fetch the current regional gas price (with localStorage cache).
 * @returns {Promise<{gasPricePerGallon:number, period:string|null, area:string|null, source:string, ageHours:number|null, fromFallback:boolean}>}
 */
export async function getGasPrice() {
  // 1. Check localStorage cache first.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      const age = Date.now() - (cached.cachedAt || 0);
      if (age < CONFIG.GAS_PRICE_CACHE_TTL_MS && cached.gasPricePerGallon > 0) {
        return { ...cached, ageHours: +(age / 3600000).toFixed(2), fromFallback: false };
      }
    }
  } catch (_) { /* localStorage may be disabled — fall through */ }

  // 2. Hit the n8n webhook.
  try {
    const res = await fetch(CONFIG.GAS_PRICE_ENDPOINT, { method: 'GET' });
    if (!res.ok) throw new Error(`gas-price webhook ${res.status}`);
    const data = await res.json();
    if (!data?.gasPricePerGallon || data.gasPricePerGallon <= 0) throw new Error('no price in response');

    const payload = {
      gasPricePerGallon: Number(data.gasPricePerGallon),
      period: data.period || null,
      area: data.area || null,
      source: data.source || 'EIA',
      cachedAt: Date.now(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (_) {}
    return { ...payload, ageHours: 0, fromFallback: false };
  } catch (err) {
    // 3. Fall back to the static config value.
    console.warn('[travel-cost] live gas price unavailable, using fallback:', err.message);
    return {
      gasPricePerGallon: CONFIG.GAS_PRICE_PER_GALLON_FALLBACK,
      period: null,
      area: null,
      source: 'fallback (config.GAS_PRICE_PER_GALLON_FALLBACK)',
      ageHours: null,
      fromFallback: true,
    };
  }
}

/**
 * Build a full travel-cost breakdown for an event address.
 * @param {string} destinationAddress — customer's event address
 * @param {object} [overrides] — { gasPricePerGallon, mpg, wearTearPerMile } to override config
 * @returns {Promise<{
 *   origin:string, destination:string,
 *   oneWayMiles:number, roundTripMiles:number,
 *   gasPricePerGallon:number, mpg:number, wearTearPerMile:number,
 *   gallonsUsed:number, fuelCost:number, wearCost:number, travelCost:number,
 *   gasPriceMeta:object
 * }>}
 */
export async function calculateTravelCost(destinationAddress, overrides = {}) {
  if (!destinationAddress) throw new Error('destinationAddress required');

  // 1. Live distance from OpenStreetMap + OSRM.
  const distance = await calculateRouteDistance(CONFIG.BUSINESS_BASE_ADDRESS, destinationAddress);
  const oneWayMiles   = Number(distance.oneWayMiles)   || 0;
  const roundTripMiles = Number(distance.roundTripMiles) || +(oneWayMiles * 2).toFixed(1);

  // 2. Live gas price (with cache + fallback).
  const gasMeta = await getGasPrice();
  const gasPricePerGallon = overrides.gasPricePerGallon ?? gasMeta.gasPricePerGallon;
  const mpg               = overrides.mpg              ?? CONFIG.VEHICLE.mpgCombined;
  const wearTearPerMile   = overrides.wearTearPerMile  ?? CONFIG.WEAR_TEAR_PER_MILE;

  // 3. Math.
  const gallonsUsed = roundTripMiles / mpg;
  const fuelCost    = gallonsUsed * gasPricePerGallon;
  const wearCost    = roundTripMiles * wearTearPerMile;
  const travelCost  = fuelCost + wearCost;

  return {
    origin: CONFIG.BUSINESS_BASE_ADDRESS,
    destination: destinationAddress,
    oneWayMiles,
    roundTripMiles,
    gasPricePerGallon: +gasPricePerGallon.toFixed(3),
    mpg,
    wearTearPerMile,
    gallonsUsed: +gallonsUsed.toFixed(2),
    fuelCost:   +fuelCost.toFixed(2),
    wearCost:   +wearCost.toFixed(2),
    travelCost: +travelCost.toFixed(2),
    gasPriceMeta: gasMeta,
  };
}

/**
 * Build an Invoice Ninja line-item for the travel fee.
 * Uses the "Travel Fee" product (price 0 in Section B) and overrides the cost.
 * @param {object} breakdown — output of calculateTravelCost()
 * @returns {{product_key:string, notes:string, cost:number, quantity:number}}
 */
export function travelCostAsInvoiceLine(breakdown) {
  const note = [
    `Travel: ${CONFIG.BUSINESS_BASE_ADDRESS} → ${breakdown.destination}`,
    `Round trip: ${breakdown.roundTripMiles} mi @ ${breakdown.mpg} mpg (${CONFIG.VEHICLE.year} ${CONFIG.VEHICLE.make} ${CONFIG.VEHICLE.model})`,
    `Fuel: ${breakdown.gallonsUsed} gal × $${breakdown.gasPricePerGallon.toFixed(3)}/gal = $${breakdown.fuelCost.toFixed(2)} (${breakdown.gasPriceMeta.area || 'fallback'}, ${breakdown.gasPriceMeta.period || 'n/a'})`,
    `Wear & tear: ${breakdown.roundTripMiles} mi × $${breakdown.wearTearPerMile.toFixed(2)} = $${breakdown.wearCost.toFixed(2)}`,
  ].join('\n');

  return {
    product_key: 'Travel Fee',
    notes: note,
    cost: breakdown.travelCost, // dollars (Invoice Ninja v5 line items use dollars, not cents)
    quantity: 1,
  };
}

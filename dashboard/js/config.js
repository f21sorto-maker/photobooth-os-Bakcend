/**
 * Centralized configuration for Photo Booth OS dashboard.
 * ---------------------------------------------------------------------------
 *   ⚠  IMPORTANT — REPLACE ALL PLACEHOLDER VALUES BEFORE FIRST USE.
 *   Every value prefixed with "YOUR_" is a placeholder — the dashboard
 *   will NOT work until you replace it with a real key/URL/ID.
 *
 *   This file runs IN THE BROWSER (outside Docker), so all API URLs
 *   must use localhost:<port> — NOT Docker internal hostnames.
 *   n8n workflows running INSIDE Docker use internal hostnames instead;
 *   those are configured in the workflow JSON files, not here.
 * ---------------------------------------------------------------------------
 */

export const CONFIG = {
  // ────────────────────────── Business Identity ──────────────────────────
  BUSINESS_NAME: 'Rewind Media Events',
  BUSINESS_OWNER_EMAIL: 'Support@rewindmediaevents.com',       // e.g. 'hello@rewindmediaevents.com'
  BUSINESS_BASE_ADDRESS: 'Dayton, OH 45402',          // Home base for travel-cost calc

  // ────────────────────────── Domain / Proxy ─────────────────────────────
  // Used in CORS headers, links, and the Settings page.
  // For local dev:  'photobooth.local'
  // For production: 'yourdomain.com'
  DOMAIN_BASE: 'photobooth.local',

  // ────────────────────────── Twenty CRM ─────────────────────────────────
  // The dashboard calls Twenty from the browser → must be proxy URL
  TWENTY_URL: 'https://crm.photobooth.local/graphql',                     // GraphQL endpoint
  TWENTY_API_KEY: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImEyNmUzNGVkLTFiMWEtNGM4Yi1hOTE4LWJjMGFhYzBiMGJhNyJ9.eyJzdWIiOiJlZDQzYjk3NC05MDM1LTQzZTctYmM3Mi1hYzM3ZTY4YTZmNGYiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiZWQ0M2I5NzQtOTAzNS00M2U3LWJjNzItYWMzN2U2OGE2ZjRmIiwiaWF0IjoxNzc5MzQzNTU0LCJleHAiOjQ5MzI5NDM1NTMsImp0aSI6IjZlMjNhZTQ2LWEwYjktNDJmMS1hNzk2LTAwNzY5MjcyYjcwNyJ9.t8aVDqHBu1r4tDGipN427kumP0Ycx0nDQLXcU5FZrNIIpQQZeG_uuVUOiGH9rSpSHHo47qpRv_ET-DCI6bNrPQ',                        // Settings → API Keys → Dashboard

  // ────────────────────────── Invoice Ninja v5 ───────────────────────────
  INVOICE_NINJA_URL: 'https://invoice.photobooth.local/api/v1',            // REST base
  INVOICE_NINJA_API_TOKEN: 'eGEugkhKRCnDCnQamuHO1R14yYlcxz5Vy0WotyBQWEbNI03XKZvzAGLPuGtwW6gI',      // Settings → Account → API Tokens

  // ────────────────────────── DocuSeal ────────────────────────────────────
  DOCUSEAL_URL: 'https://contracts.photobooth.local/api',                    // REST base
  DOCUSEAL_API_TOKEN: 'FRE6x9ypsRKVmgajZ2meVXzAt8Am8vAGqD9usyQLjTg',                // Settings → API → Token
  DOCUSEAL_TEMPLATE_ID: '1',           // Templates → your-contract → ID from URL

  // ────────────────────────── InvenTree ──────────────────────────────────
  INVENTREE_URL: 'https://inventory.photobooth.local/api',                   // REST base
  INVENTREE_API_TOKEN: 'YOUR_INVENTREE_API_TOKEN',              // Settings → API Tokens → Token

  // ────────────────────────── Listmonk ──────────────────────────────────
  LISTMONK_URL: 'https://email.photobooth.local/api',                    // REST base
  LISTMONK_USER: 'r4sorto',                                       // From .env LISTMONK_ADMIN_USER
  LISTMONK_PASSWORD: 'RW20326Net@',           // From .env LISTMONK_ADMIN_PASSWORD
  LISTMONK_INQUIRY_LIST_ID: 3,                                  // Lists → Website Inquiries → ID (integer)
  LISTMONK_BOOKING_LIST_ID: 4,                                  // Lists → Booked Clients → ID (integer)

  // ────────────────────────── n8n Webhooks ───────────────────────────────
  // The dashboard calls n8n webhooks from the browser → proxy URL
  N8N_WEBHOOK_URL: 'https://automation.photobooth.local/webhook',             // Base webhook URL
  GAS_PRICE_ENDPOINT: 'https://automation.photobooth.local/webhook/gas-price',// GET — returns current gas price JSON
  GAS_PRICE_CACHE_TTL_MS: 3 * 60 * 60 * 1000,                 // 3 hours — matches n8n refresh cadence

  // ────────────────────────── Cal.com (Booking Calendar) ─────────────────
  // Optional — you can use EITHER Cal.com OR Google Calendar (via n8n).
  // Set CALENDAR_PROVIDER to 'calcom' or 'google' to choose.
  CALCOM_URL: 'https://calendar.photobooth.local',                           // Cal.com web UI
  CALCOM_API_KEY: 'YOUR_CALCOM_API_KEY',                        // Settings → Developer → API Keys
  CALENDAR_PROVIDER: 'google',                                   // 'google' or 'calcom'

  // ────────────────────────── Travel Cost Defaults ──────────────────────
  GAS_PRICE_PER_GALLON_FALLBACK: 3.50,                         // Fallback if n8n gas-price webhook is down
  WEAR_TEAR_PER_MILE: 0.40,                                    // Depreciation + tires + oil + brakes
  HOURLY_LABOR_RATE: 30,                                        // $/hr for labor estimates

  // ────────────────────────── Vehicle ────────────────────────────────────
  VEHICLE: {
    year: 2024,
    make: 'Subaru',
    model: 'Forester Wilderness',
    mpgCombined: 25,                                            // EPA city 25 / hwy 28
    fuelGrade: 'Regular 87',                                    // Octane rating
  },

  // === Invoice Ninja Headers ===
  get NINJA_HEADERS() {
    return {
      'X-API-TOKEN': this.INVOICE_NINJA_API_TOKEN,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
  },

  // === InvenTree Headers ===
  get INVENTREE_HEADERS() {
    return { 'Authorization': `Token ${this.INVENTREE_API_TOKEN}` };
  },

  // === Fallback Product List ===
  // Used when Invoice Ninja API is unavailable
  DEFAULT_PRODUCTS: [
    { product_key: 'booth_standard', notes: 'Photo Booth – Standard (4hr)', cost: 0 },
    { product_key: 'booth_premium', notes: 'Photo Booth – Premium (6hr)', cost: 0 },
    { product_key: 'extra_hour', notes: 'Extra Hour', cost: 0 },
    { product_key: 'travel_fee', notes: 'Travel Fee', cost: 0 },
    { product_key: 'props_package', notes: 'Props Package', cost: 0 },
    { product_key: 'custom_backdrop', notes: 'Custom Backdrop', cost: 0 },
    { product_key: 'digital_gallery', notes: 'Digital Gallery Add-On', cost: 0 },
    { product_key: 'attendant_fee', notes: 'Additional Attendant', cost: 0 },
  ],
};

/**
 * URL resolver for API calls from the browser.
 * Maps a service name to its localhost URL (for browser calls).
 * NOTE: n8n workflows running INSIDE Docker use Docker internal hostnames
 * (e.g. http://twenty:3000) — those are in the workflow JSONs, not here.
 * @param {string} service — 'twenty' | 'ninja' | 'docuseal' | 'inventree' | 'listmonk' | 'n8n'
 * @returns {string} URL
 */
export function getUrl(service) {
  const urls = {
    twenty: CONFIG.TWENTY_URL,
    ninja: CONFIG.INVOICE_NINJA_URL,
    docuseal: CONFIG.DOCUSEAL_URL,
    inventree: CONFIG.INVENTREE_URL,
    listmonk: CONFIG.LISTMONK_URL,
    n8n: CONFIG.N8N_WEBHOOK_URL,
    calcom: CONFIG.CALCOM_URL,
  };
  return urls[service] || '';
}

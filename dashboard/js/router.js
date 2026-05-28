/**
 * Hash-based router for Photo Booth OS dashboard.
 * Maps URL hashes to async view render functions.
 */

import { renderOverview } from './views/overview.js';
import { renderInquiries } from './views/inquiries.js';
import { renderClientDetail } from './views/client-detail.js';
import { renderQuoteBuilder } from './views/quote-builder.js';
import { renderAccounting } from './views/accounting.js';
import { renderInventory } from './views/inventory.js';
import { renderSettings } from './views/settings.js';
import { renderClients } from './views/clients.js';

/** @type {Object<string, Function>} Map of hash paths to render functions. */
const routes = {
  '#/overview': renderOverview,
  '#/inquiries': renderInquiries,
  '#/clients': renderClients,
  '#/bookings': () => renderInquiries({ filterStatus: 'Booked' }),
  '#/invoices': renderQuoteBuilder,
  '#/contracts': renderClientDetail,
  '#/accounting': renderAccounting,
  '#/inventory': renderInventory,
  '#/settings': renderSettings,
};

/** Default route when no hash is present or hash is unknown. */
const DEFAULT_ROUTE = '#/overview';

/**
 * Parse the current hash and render the matching view.
 * Updates sidebar active state.
 */
export async function router() {
  const hash = window.location.hash || DEFAULT_ROUTE;
  const renderFn = routes[hash] || routes[DEFAULT_ROUTE];

  // Update sidebar active state
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[href="${hash}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Show loading skeleton while view renders
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="loading-skeleton" id="loading-skeleton">
      <div style="height:32px;width:200px;background:var(--bg-elevated);border-radius:var(--radius);margin-bottom:24px"></div>
      <div style="height:120px;background:var(--bg-elevated);border-radius:var(--radius);margin-bottom:16px"></div>
      <div style="height:120px;background:var(--bg-elevated);border-radius:var(--radius);margin-bottom:16px"></div>
      <div style="height:400px;background:var(--bg-elevated);border-radius:var(--radius)"></div>
    </div>
  `;

  try {
    const html = await renderFn();
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `
      <div class="card" style="text-align:center;padding:48px">
        <h2 style="margin-bottom:12px">Something went wrong</h2>
        <p style="color:var(--text-secondary)">${err.message}</p>
      </div>
    `;
  }
}

/**
 * Initialize the router. Call once on app startup.
 */
export function initRouter() {
  window.addEventListener('hashchange', router);
  if (!window.location.hash) {
    window.location.hash = DEFAULT_ROUTE;
  } else {
    router();
  }
}

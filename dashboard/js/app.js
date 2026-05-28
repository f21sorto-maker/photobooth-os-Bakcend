/**
 * Bootstrap and UI utilities for Photo Booth OS dashboard.
 * Handles theme, toast, modal, side panel, and app initialization.
 */

import { initRouter } from './router.js';
import { twentyFindPeople, ninjaGetInvoices, ninjaGetQuotes } from './api.js';

/* -------------------------------------------------------------------------- */
/*  THEME                                                                     */
/* -------------------------------------------------------------------------- */

const html = document.documentElement;
const savedTheme = localStorage.getItem('pbos-theme');
if (savedTheme) html.setAttribute('data-theme', savedTheme);

function toggleTheme() {
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('pbos-theme', next);
}

document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

/* -------------------------------------------------------------------------- */
/*  TOAST NOTIFICATIONS                                                       */
/* -------------------------------------------------------------------------- */

const toastContainer = document.getElementById('toast-container');

/**
 * Show a toast notification that auto-dismisses after 4 seconds.
 * @param {string} message — toast text
 * @param {string} [type] — 'success' | 'error' | 'warning' (default 'success')
 */
export function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  el.setAttribute('role', 'status');
  toastContainer.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

/* -------------------------------------------------------------------------- */
/*  MODAL                                                                     */
/* -------------------------------------------------------------------------- */

const modalRoot = document.getElementById('modal-root');

/**
 * Open a full-screen centered modal with the given HTML content.
 * @param {string} html — inner HTML for the modal body
 * @param {object} [opts] — { title, onClose, showFooter, footerButtons }
 */
export function openModal(html, opts = {}) {
  const { title = '', onClose, showFooter = false, footerButtons = '' } = opts;
  modalRoot.style.display = 'block';
  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        ${title ? `<div class="modal-header"><h2>${title}</h2><button class="modal-close" aria-label="Close modal">&times;</button></div>` : ''}
        <div class="modal-body">${html}</div>
        ${showFooter ? `<div class="modal-footer">${footerButtons}</div>` : ''}
      </div>
    </div>
  `;

  const backdrop = document.getElementById('modal-backdrop');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  modalRoot.querySelector('.modal-close')?.addEventListener('click', closeModal);

  if (onClose) {
    const originalClose = closeModal;
    window._modalOnClose = onClose;
  }
}

/**
 * Close the currently open modal.
 */
export function closeModal() {
  modalRoot.style.display = 'none';
  modalRoot.innerHTML = '';
  if (window._modalOnClose) {
    window._modalOnClose();
    delete window._modalOnClose;
  }
}

/* -------------------------------------------------------------------------- */
/*  SIDE PANEL                                                                */
/* -------------------------------------------------------------------------- */

const sidePanelRoot = document.getElementById('side-panel-root');

/**
 * Open a slide-in side panel from the right.
 * @param {string} html — panel content HTML
 */
export function openSidePanel(html) {
  sidePanelRoot.style.display = 'block';
  sidePanelRoot.innerHTML = `
    <div class="side-panel-backdrop" id="side-panel-backdrop"></div>
    <div class="side-panel">${html}</div>
  `;
  document.getElementById('side-panel-backdrop')?.addEventListener('click', closeSidePanel);
}

/**
 * Close the side panel.
 */
export function closeSidePanel() {
  sidePanelRoot.style.display = 'none';
  sidePanelRoot.innerHTML = '';
}

/* -------------------------------------------------------------------------- */
/*  GLOBAL SEARCH                                                             */
/* -------------------------------------------------------------------------- */

function initGlobalSearch() {
  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  if (!searchInput || !searchResults) return;

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim().toLowerCase();
    
    if (!query || query.length < 2) {
      searchResults.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      searchResults.innerHTML = '<div style="padding:12px;color:var(--text-secondary)">Searching...</div>';
      searchResults.style.display = 'block';

      try {
        const [people, invoices, quotes] = await Promise.all([
          twentyFindPeople(),
          ninjaGetInvoices(),
          ninjaGetQuotes()
        ]);

        const matchedPeople = people.filter(p => 
          (p.name?.firstName || '').toLowerCase().includes(query) ||
          (p.name?.lastName || '').toLowerCase().includes(query) ||
          (p.emails?.primaryEmail || '').toLowerCase().includes(query) ||
          (p.phones?.primaryPhoneNumber || '').includes(query)
        ).slice(0, 5);

        const matchedInvoices = invoices.filter(i => 
          (i.number || '').toLowerCase().includes(query) ||
          (i.client?.name || '').toLowerCase().includes(query)
        ).slice(0, 5);

        const matchedQuotes = quotes.filter(q => 
          (q.number || '').toLowerCase().includes(query) ||
          (q.client?.name || '').toLowerCase().includes(query)
        ).slice(0, 5);

        let html = '';

        if (matchedPeople.length > 0) {
          html += '<div class="search-group-title">Clients (CRM)</div>';
          matchedPeople.forEach(p => {
            html += `
              <div class="search-item" onclick="window.location.hash='#/clients?id=${p.id}'; document.getElementById('global-search').value=''; document.getElementById('search-results').style.display='none';">
                <div class="search-item-title">${p.name?.firstName || ''} ${p.name?.lastName || ''}</div>
                <div class="search-item-subtitle">${p.emails?.primaryEmail || p.phones?.primaryPhoneNumber || 'No contact info'}</div>
              </div>
            `;
          });
        }

        if (matchedInvoices.length > 0) {
          html += '<div class="search-group-title">Invoices</div>';
          matchedInvoices.forEach(i => {
            html += `
              <div class="search-item" onclick="window.location.hash='#/invoices?edit=${i.id}&type=invoice'; document.getElementById('global-search').value=''; document.getElementById('search-results').style.display='none';">
                <div class="search-item-title">${i.number}</div>
                <div class="search-item-subtitle">${i.client?.name || 'Unknown Client'} - $${i.amount}</div>
              </div>
            `;
          });
        }

        if (matchedQuotes.length > 0) {
          html += '<div class="search-group-title">Quotes</div>';
          matchedQuotes.forEach(q => {
            html += `
              <div class="search-item" onclick="window.location.hash='#/invoices?edit=${q.id}&type=quote'; document.getElementById('global-search').value=''; document.getElementById('search-results').style.display='none';">
                <div class="search-item-title">${q.number}</div>
                <div class="search-item-subtitle">${q.client?.name || 'Unknown Client'} - $${q.amount}</div>
              </div>
            `;
          });
        }

        if (html === '') {
          html = '<div style="padding:12px;color:var(--text-secondary)">No results found.</div>';
        }

        searchResults.innerHTML = html;
      } catch (err) {
        console.error('Search error', err);
        searchResults.innerHTML = '<div style="padding:12px;color:var(--red)">Error fetching results.</div>';
      }
    }, 300);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults.style.display = 'none';
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  BOOTSTRAP                                                                 */
/* -------------------------------------------------------------------------- */

initRouter();
initGlobalSearch();

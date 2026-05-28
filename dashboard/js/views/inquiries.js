/**
 * Inquiries management view — Photo Booth OS
 * Table with filters, status badges, search, and action menus.
 */

import { twentyFindPeople, twentyUpdatePerson, STATUS_ENUM_TO_LABEL, STATUS_LABEL_TO_ENUM } from '../api.js';
import { formatCurrency, formatDate, debounce } from '../utils.js';
import { showToast, openModal, closeModal } from '../app.js';

// Status options use DISPLAY LABELS for the UI, but ENUM VALUES are used for CRM queries/updates
const STATUS_OPTIONS = ['Follow Up', 'Unsure', 'Denied', 'Booked'];
const STATUS_BADGE_MAP = {
  'Follow Up': 'badge-follow-up',
  'Unsure': 'badge-unsure',
  'Denied': 'badge-denied',
  'Booked': 'badge-booked',
};

export async function renderInquiries(opts = {}) {
  const { filterStatus } = opts;

  let allPeople = [];
  try {
    allPeople = await twentyFindPeople();
  } catch (err) {
    console.error('[inquiries] failed to load:', err);
    showToast('Could not load inquiries. Check Twenty CRM connection.', 'error');
  }

  // Store in module scope for filtering
  window._inquiriesData = allPeople;
  window._inquiriesFilterStatus = filterStatus || '';

  const html = `
    <div style="margin-bottom:var(--space-xl)">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:var(--space-xs)">
        ${filterStatus ? filterStatus + ' Inquiries' : 'All Inquiries'}
      </h1>
      <p style="color:var(--text-secondary)">${allPeople.length} total records</p>
    </div>

    <div class="filter-bar">
      <input type="text" id="inq-search" class="form-input" placeholder="Search by name, email, or event type..." style="min-width:260px">
      <select id="inq-status" class="form-select">
        <option value="">All Statuses</option>
        ${STATUS_OPTIONS.map(s => `<option value="${s}" ${filterStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="inq-refresh">Refresh</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div id="inq-table-container" style="overflow-x:auto">
        ${renderTable(allPeople, filterStatus, '')}
      </div>
    </div>
  `;

  setTimeout(() => attachListeners(), 0);
  return html;
}

function renderTable(people, statusFilter, searchQuery) {
  let filtered = people;

  if (statusFilter) {
    // statusFilter is a display label (e.g. 'Booked'), convert to enum for comparison
    const enumVal = STATUS_LABEL_TO_ENUM[statusFilter] || statusFilter;
    filtered = filtered.filter(p => {
      const label = STATUS_ENUM_TO_LABEL[p.inquiryStatus] || p.inquiryStatus;
      return p.inquiryStatus === enumVal || label === statusFilter;
    });
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(p => {
      const name = `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      const type = (p.eventType || '').toLowerCase();
      return name.includes(q) || email.includes(q) || type.includes(q);
    });
  }

  if (filtered.length === 0) {
    return `<p style="color:var(--text-secondary);text-align:center;padding:48px">No inquiries match your filters.</p>`;
  }

  return `
    <table class="table" id="inq-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Event Date</th>
          <th>Type</th>
          <th>Status</th>
          <th>Guests</th>
          <th>Est. Revenue</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(p => {
          const name = `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.trim() || 'Unnamed';
          // Convert enum to display label for rendering
          const statusLabel = STATUS_ENUM_TO_LABEL[p.inquiryStatus] || p.inquiryStatus || 'Follow Up';
          const badgeClass = STATUS_BADGE_MAP[statusLabel] || 'badge-unsure';
          return `
            <tr data-id="${p.id}">
              <td>
                <div style="font-weight:600">${name}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${p.email || '—'}</div>
              </td>
              <td>${formatDate(p.eventDate)}</td>
              <td>${p.eventType || '—'}</td>
              <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
              <td>${p.guestCount || '—'}</td>
              <td>${formatCurrency(p.estimatedRevenue || 0)}</td>
              <td style="text-align:right">
                <div style="display:flex;gap:var(--space-xs);justify-content:flex-end">
                  <button class="btn btn-secondary" data-action="view" data-id="${p.id}" title="View Details">View</button>
                  <button class="btn btn-secondary" data-action="quote" data-id="${p.id}" title="Build Quote">Quote</button>
                  <select class="form-select" data-action="status" data-id="${p.id}" style="width:auto;min-width:120px;padding:5px 24px 5px 8px;font-size:12px" title="Change Status">
                    <option value="" disabled ${!p.inquiryStatus ? 'selected' : ''}>Set Status…</option>
                    ${STATUS_OPTIONS.map(s => `<option value="${s}" ${statusLabel === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function attachListeners() {
  const container = document.getElementById('inq-table-container');
  if (!container) return;

  // Search debounced filter
  const searchInput = document.getElementById('inq-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const q = searchInput.value;
      const data = window._inquiriesData || [];
      const status = document.getElementById('inq-status')?.value || window._inquiriesFilterStatus || '';
      container.innerHTML = renderTable(data, status, q);
      attachRowListeners();
    }, 200));
  }

  // Status filter dropdown
  const statusSelect = document.getElementById('inq-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      const status = statusSelect.value;
      const data = window._inquiriesData || [];
      const q = searchInput?.value || '';
      container.innerHTML = renderTable(data, status, q);
      attachRowListeners();
    });
  }

  // Refresh button
  document.getElementById('inq-refresh')?.addEventListener('click', () => {
    window.location.reload();
  });

  attachRowListeners();
}

function attachRowListeners() {
  // View button
  document.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      window.location.hash = `#/contracts?id=${id}`;
    });
  });

  // Quote button
  document.querySelectorAll('[data-action="quote"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      window.location.hash = `#/invoices?client=${id}`;
    });
  });

  // Status change dropdown
  document.querySelectorAll('[data-action="status"]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = sel.dataset.id;
      const newStatusLabel = sel.value; // display label (e.g. 'Booked')
      const newStatusEnum = STATUS_LABEL_TO_ENUM[newStatusLabel] || newStatusLabel; // enum value (e.g. 'BOOKED')
      sel.disabled = true;
      try {
        await twentyUpdatePerson(id, { inquiryStatus: newStatusEnum });
        showToast(`Status updated to ${newStatusLabel}`);
        // Re-render this row's badge
        const row = sel.closest('tr');
        const badgeCell = row?.querySelector('td:nth-child(4)');
        if (badgeCell) {
          const badgeClass = STATUS_BADGE_MAP[newStatusLabel] || 'badge-unsure';
          badgeCell.innerHTML = `<span class="badge ${badgeClass}">${newStatusLabel}</span>`;
        }
      } catch (err) {
        showToast('Failed to update status: ' + err.message, 'error');
      } finally {
        sel.disabled = false;
      }
    });
  });
}

/**
 * Clients view — Photo Booth OS
 * Manage clients with the ability to search, filter, and add new clients.
 */

import { twentyFindPeople, twentyCreatePerson } from '../api.js';
import { formatCurrency, formatDate, debounce, timeAgo } from '../utils.js';
import { showToast, openModal, closeModal } from '../app.js';

export async function renderClients() {
  let people = [];
  try {
    people = await twentyFindPeople();
    // Sort by newest first
    people.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    showToast('Failed to load clients', 'error');
  }

  // Filter out those who are not strictly "clients" yet, or just show all.
  // For now, let's show all and label them.
  window._clientsData = people;

  const html = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:var(--space-xl)">
      <div>
        <h1 style="font-size:22px;font-weight:700;margin-bottom:var(--space-xs)">Clients</h1>
        <p style="color:var(--text-secondary)">Manage your contacts and clients.</p>
      </div>
      <div>
        <button class="btn btn-primary" id="btn-add-client">Add Client</button>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg)">
        <div class="form-field" style="flex:1;margin:0">
          <input type="text" class="form-input" id="client-search" placeholder="Search by name, email, or phone...">
        </div>
      </div>
      <div id="client-table-container">
        ${renderClientTable(people)}
      </div>
    </div>
  `;

  setTimeout(() => attachListeners(), 0);
  return html;
}

function renderClientTable(people) {
  if (people.length === 0) {
    return `<div style="text-align:center;padding:48px;color:var(--text-secondary)">No clients yet. Click 'New Client' to add your first one.</div>`;
  }

  return `
    <table class="table" id="client-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Contact</th>
          <th>Event Type</th>
          <th>Address</th>
          <th>Date Added</th>
          <th style="text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${people.map(p => {
    const name = `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.trim() || 'Unnamed';
    return `
            <tr data-id="${p.id}">
              <td>
                <div style="font-weight:600">${name}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${p.inquiryStatus || 'Lead'}</div>
              </td>
              <td>
                <div style="font-size:13px">${p.email || '—'}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${p.phone || '—'}</div>
              </td>
              <td>${p.eventType || '—'}</td>
              <td><div style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.eventAddress || ''}">${p.eventAddress || '—'}</div></td>
              <td>
                <div style="font-size:13px">${formatDate(p.createdAt)}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${timeAgo(p.createdAt)}</div>
              </td>
              <td style="text-align:right">
                <a href="#/contracts?id=${p.id}" class="btn btn-secondary" style="font-size:12px;padding:4px 8px">View Details</a>
              </td>
            </tr>
          `;
  }).join('')}
      </tbody>
    </table>
  `;
}

function attachListeners() {
  const searchInput = document.getElementById('client-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      const q = e.target.value.toLowerCase();
      let filtered = window._clientsData;
      if (q) {
        filtered = filtered.filter(p => {
          const name = `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.toLowerCase();
          return name.includes(q) || (p.email && p.email.toLowerCase().includes(q)) || (p.phone && p.phone.includes(q));
        });
      }
      document.getElementById('client-table-container').innerHTML = renderClientTable(filtered);
    }, 300));
  }

  const addBtn = document.getElementById('btn-add-client');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openModal(`
        <form id="add-client-form">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-field">
              <label class="form-label">First Name *</label>
              <input type="text" id="add-fname" class="form-input" required>
            </div>
            <div class="form-field">
              <label class="form-label">Last Name *</label>
              <input type="text" id="add-lname" class="form-input" required>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Email</label>
            <input type="email" id="add-email" class="form-input">
          </div>
          <div class="form-field">
            <label class="form-label">Phone</label>
            <input type="tel" id="add-phone" class="form-input">
          </div>
          <div class="form-field">
            <label class="form-label">Event Type</label>
            <input type="text" id="add-event" class="form-input" placeholder="e.g. Wedding, Corporate">
          </div>
        </form>
      `, {
        title: 'Add New Client',
        showFooter: true,
        footerButtons: `
          <button class="btn btn-secondary" id="btn-cancel-add">Cancel</button>
          <button class="btn btn-primary" id="btn-save-add">Save Client</button>
        `
      });

      document.getElementById('btn-cancel-add').addEventListener('click', closeModal);
      document.getElementById('btn-save-add').addEventListener('click', async () => {
        const fname = document.getElementById('add-fname').value.trim();
        const lname = document.getElementById('add-lname').value.trim();
        const email = document.getElementById('add-email').value.trim();
        const phone = document.getElementById('add-phone').value.trim();
        const eventType = document.getElementById('add-event').value.trim();

        if (!fname || !lname) {
          showToast('First and last name are required', 'error');
          return;
        }

        const btn = document.getElementById('btn-save-add');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
          await twentyCreatePerson({
            name: { firstName: fname, lastName: lname },
            emails: { primaryEmail: email || '' },
            phones: { primaryPhoneNumber: phone || '' },
            eventType: eventType || '',
            inquiryStatus: 'FOLLOW_UP', // Default status for new manual clients
            source: 'MANUAL_ENTRY'
          });
          showToast('Client added successfully');
          closeModal();
          // Reload view
          document.getElementById('content').innerHTML = await renderClients();
        } catch (err) {
          showToast('Failed to create client: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Save Client';
        }
      });
    });
  }
}

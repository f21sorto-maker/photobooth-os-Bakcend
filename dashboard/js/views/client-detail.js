/**
 * Client detail view — Photo Booth OS
 * Full-page client profile with tabs: Overview, Notes & Messages, Quotes & Invoices, Financials.
 */

import { 
  twentyFindPeople, twentyUpdatePerson, twentyUpdatePersonNotes, twentyAddActivity, 
  ninjaGetClientInvoices, docusealCreateSubmission, n8nTrigger,
  ninjaEmailEntity, ninjaDuplicate, ninjaConvertQuote, ninjaUpdateInvoice
} from '../api.js';
import { formatCurrency, formatDate } from '../utils.js';
import { showToast, openModal, closeModal } from '../app.js';
import { CONFIG } from '../config.js';

let currentClient = null;
let currentTab = 'overview';
let invoiceNinjaData = [];
let expensesData = []; // Internal expenses

export async function renderClientDetail() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const clientId = params.get('id');

  if (!clientId) {
    return `<div class="card" style="text-align:center;padding:64px">
      <h2>No Client Selected</h2>
      <a href="#/inquiries" class="btn btn-primary" style="margin-top:16px">Go to Inquiries</a>
    </div>`;
  }

  try {
    const people = await twentyFindPeople();
    currentClient = people.find(p => p.id === clientId);
  } catch (err) {
    showToast('Failed to load client details.', 'error');
    return `<div class="card" style="text-align:center;padding:48px"><p>${err.message}</p></div>`;
  }

  if (!currentClient) {
    return `<div class="card" style="text-align:center;padding:64px">
      <h2>Client Not Found</h2>
      <a href="#/inquiries" class="btn btn-primary" style="margin-top:16px">Go to Inquiries</a>
    </div>`;
  }

  // Pre-fetch Ninja data if linked
  if (currentClient.invoiceNinjaClientId) {
    try {
      invoiceNinjaData = await ninjaGetClientInvoices(currentClient.invoiceNinjaClientId);
    } catch (err) {
      console.error('Failed to fetch Ninja data', err);
    }
  }

  const name = `${currentClient.name?.firstName || ''} ${currentClient.name?.lastName || ''}`.trim() || 'Unnamed';

  const html = `
    <div style="margin-bottom:var(--space-md)">
      <a href="#/inquiries" class="btn btn-secondary" style="margin-bottom:var(--space-md)">← Back</a>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 style="font-size:24px;font-weight:700">${name}</h1>
          <p style="color:var(--text-secondary)">${currentClient.email || 'No Email'} · ${currentClient.phone || 'No Phone'}</p>
        </div>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn-secondary" data-action="edit-info">Edit Info</button>
          <button class="btn btn-primary" onclick="window.location.hash='#/invoices?client=${currentClient.id}'">Generate Quote</button>
          <button class="btn btn-secondary" data-action="send-contract">Send Contract</button>
          <button class="btn btn-secondary" data-action="add-to-calendar">Add to Calendar</button>
          <button class="btn btn-secondary" data-action="log-call">Log Call</button>
        </div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tabs" style="display:flex;gap:var(--space-md);border-bottom:1px solid var(--border);margin-bottom:var(--space-lg)">
      <div class="tab ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid ${currentTab === 'overview' ? 'var(--teal)' : 'transparent'};color:${currentTab === 'overview' ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:600">Overview</div>
      <div class="tab ${currentTab === 'notes' ? 'active' : ''}" data-tab="notes" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid ${currentTab === 'notes' ? 'var(--teal)' : 'transparent'};color:${currentTab === 'notes' ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:600">Notes & Messages</div>
      <div class="tab ${currentTab === 'quotes' ? 'active' : ''}" data-tab="quotes" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid ${currentTab === 'quotes' ? 'var(--teal)' : 'transparent'};color:${currentTab === 'quotes' ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:600">Quotes & Invoices</div>
      <div class="tab ${currentTab === 'financials' ? 'active' : ''}" data-tab="financials" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid ${currentTab === 'financials' ? 'var(--teal)' : 'transparent'};color:${currentTab === 'financials' ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:600">Financial Breakdown</div>
    </div>

    <!-- TAB CONTENT -->
    <div id="tab-content">
      ${renderTabContent()}
    </div>
  `;

  setTimeout(() => {
    attachTabListeners();
    attachGlobalActionListeners();
  }, 0);

  return html;
}

function renderTabContent() {
  if (currentTab === 'overview') return renderOverviewTab();
  if (currentTab === 'notes') return renderNotesTab();
  if (currentTab === 'quotes') return renderQuotesTab();
  if (currentTab === 'financials') return renderFinancialsTab();
  return '';
}

function attachTabListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.tab;
      // Re-render the whole view or just the tab content
      document.getElementById('content').innerHTML = renderClientDetail().then(html => {
        document.getElementById('content').innerHTML = html;
      });
    });
  });
}

function renderOverviewTab() {
  // Timeline pseudo-data based on booleans
  let timeline = [];
  if (currentClient.createdAt) timeline.push({ date: currentClient.createdAt, title: 'Inquiry Created' });
  if (currentClient.contractSent) timeline.push({ date: currentClient.createdAt, title: 'Contract Sent' });
  if (currentClient.contractSigned) timeline.push({ date: currentClient.createdAt, title: 'Contract Signed' });
  if (currentClient.depositPaid) timeline.push({ date: currentClient.createdAt, title: 'Deposit Paid' });

  return `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--space-lg)">
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">
        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Event Details</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
            <div class="form-field">
              <label class="form-label">Status</label>
              <select id="detail-status" class="form-select" data-id="${currentClient.id}">
                <option value="FOLLOW_UP" ${currentClient.inquiryStatus === 'FOLLOW_UP' ? 'selected' : ''}>Follow Up</option>
                <option value="UNSURE" ${currentClient.inquiryStatus === 'UNSURE' ? 'selected' : ''}>Unsure</option>
                <option value="DENIED" ${currentClient.inquiryStatus === 'DENIED' ? 'selected' : ''}>Denied</option>
                <option value="BOOKED" ${currentClient.inquiryStatus === 'BOOKED' ? 'selected' : ''}>Booked</option>
              </select>
            </div>
            <div class="form-field"><label class="form-label">Event Date</label><p>${formatDate(currentClient.eventDate)}</p></div>
            <div class="form-field"><label class="form-label">Event Type</label><p>${currentClient.eventType || '—'}</p></div>
            <div class="form-field"><label class="form-label">Venue</label><p>${currentClient.eventAddress || '—'}</p></div>
            <div class="form-field"><label class="form-label">Guests</label><p>${currentClient.guestCount || '—'}</p></div>
            <div class="form-field"><label class="form-label">Source</label><p>${currentClient.source || '—'}</p></div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Activity Timeline</h2>
        <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
          ${timeline.map(t => `
            <div style="display:flex;gap:var(--space-sm);align-items:flex-start">
              <div style="width:10px;height:10px;border-radius:50%;background:var(--teal);margin-top:6px"></div>
              <div>
                <div style="font-size:13px;font-weight:600">${t.title}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${formatDate(t.date)}</div>
              </div>
            </div>
          `).join('')}
          ${timeline.length === 0 ? '<p style="color:var(--text-secondary);font-size:13px">No activity yet.</p>' : ''}
        </div>
      </div>
    </div>
  `;
}

function renderNotesTab() {
  setTimeout(() => {
    const noteArea = document.getElementById('client-notes');
    const status = document.getElementById('note-save-status');
    
    if(noteArea) {
      noteArea.addEventListener('blur', async () => {
        status.textContent = 'Saving...';
        status.style.color = 'var(--yellow)';
        try {
          await twentyUpdatePersonNotes(currentClient.id, noteArea.value);
          status.textContent = 'Saved ✓';
          status.style.color = 'var(--green)';
          setTimeout(() => status.textContent = '', 3000);
        } catch(e) {
          status.textContent = 'Save failed — click to retry';
          status.style.color = 'var(--red)';
        }
      });
      
      status.addEventListener('click', async () => {
        if(status.textContent.includes('failed')) {
          // manually trigger blur to save
          noteArea.focus();
          noteArea.blur();
        }
      });

      document.getElementById('send-msg-btn')?.addEventListener('click', async () => {
        const subject = document.getElementById('msg-subj').value;
        const body = document.getElementById('msg-body').value;
        if(!subject || !body) return showToast('Subject and body required', 'error');
        showToast('Sending message...', 'warning');
        try {
          await n8nTrigger('send-client-email', {
            clientEmail: currentClient.emails?.primaryEmail,
            subject,
            body
          });
          showToast('Message sent via n8n!');
          document.getElementById('msg-subj').value = '';
          document.getElementById('msg-body').value = '';
        } catch(e) {
          showToast('Failed to send message: ' + e.message, 'error');
        }
      });
    }
  }, 0);

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
          <h2 style="font-size:16px;font-weight:600">Client Notes</h2>
          <span id="note-save-status" style="font-size:12px;font-weight:600"></span>
        </div>
        <textarea id="client-notes" class="form-textarea" rows="10" placeholder="Freeform notes auto-save...">${currentClient.notes || ''}</textarea>
      </div>
      <div class="card">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-sm)">Send Message</h2>
        <input type="text" id="msg-subj" class="form-input" placeholder="Subject" style="margin-bottom:var(--space-sm)">
        <textarea id="msg-body" class="form-textarea" rows="6" placeholder="Message body..." style="margin-bottom:var(--space-sm)"></textarea>
        <button id="send-msg-btn" class="btn btn-primary">Send Email</button>
      </div>
    </div>
  `;
}

function renderQuotesTab() {
  const totalQuoted = invoiceNinjaData.filter(d => d.documentType === 'Quote').reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalInvoiced = invoiceNinjaData.filter(d => d.documentType === 'Invoice' && d.status_id === '4').reduce((sum, d) => sum + (d.amount || 0), 0);

  setTimeout(() => {
    document.querySelectorAll('.btn-preview').forEach(btn => btn.addEventListener('click', (e) => {
      const type = e.target.dataset.type;
      const id = e.target.dataset.id;
      const url = `${CONFIG.INVOICE_NINJA_URL.replace('/api/v1','')}/${type}s/${id}/pdf`;
      openModal(`<iframe src="${url}" style="width:100%;height:70vh;border:none"></iframe>`, { title: 'PDF Preview', showFooter: false });
    }));
    document.querySelectorAll('.btn-send').forEach(btn => btn.addEventListener('click', async (e) => {
      const type = e.target.dataset.type.toLowerCase();
      const id = e.target.dataset.id;
      try {
        showToast('Sending...', 'warning');
        await ninjaEmailEntity(type, id);
        showToast('Sent successfully!');
      } catch(err) {
        showToast('Failed to send: ' + err.message, 'error');
      }
    }));
    document.querySelectorAll('.btn-void').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      try {
        await ninjaUpdateInvoice(id, { status_id: '-1' }); // cancelled
        showToast('Cancelled invoice');
        document.getElementById('content').innerHTML = await renderClientDetail(); // refresh
      } catch(err) {
        showToast('Failed to cancel', 'error');
      }
    }));
  }, 0);

  return `
    <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-lg)">
      <div class="stat-card"><div class="label">Total Quoted</div><div class="value">${formatCurrency(totalQuoted)}</div></div>
      <div class="stat-card"><div class="label">Total Paid (Invoices)</div><div class="value" style="color:var(--green)">${formatCurrency(totalInvoiced)}</div></div>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Type</th><th>Number</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${invoiceNinjaData.map(d => `
            <tr>
              <td>${d.documentType}</td>
              <td>${d.number}</td>
              <td>${d.date}</td>
              <td>${formatCurrency(d.amount)}</td>
              <td>${d.status_id === '4' ? 'Paid/Approved' : 'Draft/Sent'}</td>
              <td style="display:flex;gap:var(--space-xs)">
                <button class="btn btn-secondary btn-preview" style="padding:4px 8px;font-size:12px" data-type="${d.documentType.toLowerCase()}" data-id="${d.id}">Preview</button>
                <button class="btn btn-secondary" style="padding:4px 8px;font-size:12px" onclick="window.location.hash='#/invoices?edit=${d.id}&type=${d.documentType.toLowerCase()}'">Edit</button>
                <button class="btn btn-secondary btn-send" style="padding:4px 8px;font-size:12px" data-type="${d.documentType}" data-id="${d.id}">Send</button>
                ${d.documentType === 'Invoice' ? `<button class="btn btn-secondary btn-void" style="padding:4px 8px;font-size:12px" data-id="${d.id}">Void</button>` : ''}
              </td>
            </tr>
          `).join('')}
          ${invoiceNinjaData.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--text-secondary)">No quotes or invoices</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
}

function renderFinancialsTab() {
  const rev = currentClient.estimatedRevenue || 0;
  const cost = currentClient.estimatedCost || 0;
  const profit = rev - cost;
  const margin = rev > 0 ? (profit / rev) * 100 : 0;
  let marginColor = 'var(--red)';
  if (margin >= 40) marginColor = 'var(--green)';
  else if (margin >= 20) marginColor = 'var(--yellow)';

  return `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-md);margin-bottom:var(--space-lg)">
      <div class="stat-card"><div class="label">Quoted Revenue</div><div class="value">${formatCurrency(rev)}</div></div>
      <div class="stat-card"><div class="label">Estimated Cost</div><div class="value" style="color:var(--red)">${formatCurrency(cost)}</div></div>
      <div class="stat-card"><div class="label">Gross Margin</div><div class="value" style="color:${marginColor}">${margin.toFixed(1)}%</div></div>
    </div>
    <div class="card">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Internal Expense Log (Invoice Ninja)</h2>
      <p style="color:var(--text-secondary);font-size:13px">Any expenses linked to this client ID in Invoice Ninja will appear here.</p>
    </div>
  `;
}

function attachGlobalActionListeners() {
  document.querySelector('#detail-status')?.addEventListener('change', async (e) => {
    const newStatus = e.target.value;
    const id = e.target.dataset.id;
    try {
      await twentyUpdatePerson(id, { inquiryStatus: newStatus });
      showToast('Status updated');
      currentClient.inquiryStatus = newStatus;
    } catch(err) {
      showToast('Failed to update status', 'error');
      // revert dropdown
      e.target.value = currentClient.inquiryStatus || 'FOLLOW_UP';
    }
  });

  document.querySelector('[data-action="send-contract"]')?.addEventListener('click', async () => {
    if (!currentClient.email) return showToast('No email', 'error');
    if (confirm('Create DocuSeal submission?')) {
      showToast('Sending...', 'warning');
      try {
        await n8nTrigger('send-contract', currentClient);
        showToast('Contract sent via n8n webhook!');
      } catch(e) { showToast('Error: ' + e.message, 'error'); }
    }
  });

  document.querySelector('[data-action="add-to-calendar"]')?.addEventListener('click', async () => {
    showToast('Adding to calendar...', 'warning');
    try {
      await n8nTrigger('add-to-calendar', currentClient);
      showToast('Added to Calendar via n8n!');
    } catch(e) { showToast('Error: ' + e.message, 'error'); }
  });

  document.querySelector('[data-action="log-call"]')?.addEventListener('click', async () => {
    const note = prompt('Enter call notes:');
    if(note) {
      try {
        await twentyAddActivity(currentClient.id, note, 'Call Logged');
        showToast('Call logged successfully');
      } catch(err) {
        showToast('Failed to log call', 'error');
      }
    }
  });
}

/**
 * Quote & Invoice Editor — Photo Booth OS
 * Full-screen editor for Invoice Ninja documents with internal supply cost tracking.
 */

import { ninjaRequest, ninjaGetProducts, ninjaEmailEntity, ninjaConvertQuote, twentyFindPeople, twentyUpdatePerson, n8nTrigger } from '../api.js';
import { formatCurrency, formatDate } from '../utils.js';
import { showToast, openModal } from '../app.js';
import { CONFIG } from '../config.js';

let currentState = {
  isNew: true,
  entityType: 'quote', // 'quote' or 'invoice'
  id: null,
  clientId: null,
  clientData: null,
  crmPerson: null,
  document: null,
  products: [],
  lineItems: [], // { product_key, notes, cost, quantity, tax_name1, tax_rate1, discount, _isSupply }
};

export async function renderQuoteBuilder() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  const editId = params.get('edit');
  const type = params.get('type') || 'quote';
  const clientId = params.get('client');

  currentState = { isNew: !editId, entityType: type, id: editId, clientId, products: [], lineItems: [] };

  try {
    const people = await twentyFindPeople();
    
    let products = [];
    try {
      products = await ninjaGetProducts();
    } catch (err) {
      console.warn('Using default products fallback', err);
      products = CONFIG.DEFAULT_PRODUCTS || [];
    }
    currentState.products = products;

    if (editId) {
      const res = await ninjaRequest('GET', `/${type}s/${editId}?include=client`);
      currentState.document = res.data;
      currentState.clientId = currentState.document.client_id;
      currentState.clientData = currentState.document.client;
      
      // Load line items
      if (currentState.document.line_items) {
        currentState.lineItems = currentState.document.line_items.map(li => ({
          ...li,
          _isSupply: li.product_key === 'INTERNAL_SUPPLY' // Custom convention
        }));
      }
    } else if (clientId) {
      // Find CRM person
      currentState.crmPerson = people.find(p => p.id === clientId);
      
      // Auto-create client in Ninja if missing
      if (!currentState.crmPerson?.invoiceNinjaClientId) {
        showToast('Creating client in Invoice Ninja...', 'warning');
        const fname = currentState.crmPerson?.name?.firstName || 'Unknown';
        const lname = currentState.crmPerson?.name?.lastName || 'Client';
        const email = currentState.crmPerson?.email || '';
        const phone = currentState.crmPerson?.phone || '';
        
        try {
          const createRes = await ninjaRequest('POST', '/clients', {
            name: `${fname} ${lname}`,
            contacts: [{ first_name: fname, last_name: lname, email, phone }]
          });
          currentState.clientId = createRes.data.id;
          
          // Link ID back to Twenty CRM
          await twentyUpdatePerson(clientId, { invoiceNinjaClientId: currentState.clientId });
          currentState.crmPerson.invoiceNinjaClientId = currentState.clientId;
        } catch(e) {
          return `<div class="card" style="padding:48px;text-align:center"><h2>Failed to create client in Invoice Ninja</h2><p>${e.message}</p><a href="#/contracts?id=${clientId}" class="btn btn-primary">Go Back</a></div>`;
        }
      } else {
        currentState.clientId = currentState.crmPerson.invoiceNinjaClientId;
      }
      
      try {
        const res = await ninjaRequest('GET', `/clients/${currentState.clientId}`);
        currentState.clientData = res.data;
      } catch(e) {
        console.warn('Could not fetch client data from Ninja', e);
      }
    } else {
      return `<div class="card" style="padding:48px;text-align:center"><h2>No client or document specified</h2></div>`;
    }
  } catch (err) {
    return `<div class="card" style="padding:48px;text-align:center;color:var(--red)">Failed to load: ${err.message}</div>`;
  }

  // Supply costs from CRM if new
  if (currentState.isNew && currentState.crmPerson && currentState.crmPerson.estimatedCost) {
    currentState.lineItems.push({
      product_key: 'INTERNAL_SUPPLY',
      notes: 'Estimated Supply / Internal Cost',
      cost: currentState.crmPerson.estimatedCost / 100, // stored in micros/cents
      quantity: 1,
      _isSupply: true
    });
  }

  setTimeout(() => {
    renderLines();
    attachGlobalListeners();
  }, 0);

  return `
    <div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:var(--space-md)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <h1 style="font-size:24px;font-weight:700;text-transform:capitalize">${currentState.isNew ? 'New' : 'Edit'} ${currentState.entityType}</h1>
          <p style="color:var(--text-secondary)">${currentState.clientData?.name || 'Unknown Client'} · ${currentState.document?.number || 'Draft'}</p>
        </div>
        <div style="display:flex;gap:var(--space-sm)">
          <button class="btn btn-secondary" onclick="window.history.back()">Cancel</button>
          <button class="btn btn-secondary" id="qb-preview" ${currentState.isNew ? 'disabled' : ''}>Preview</button>
          <button class="btn btn-secondary" id="qb-print" ${currentState.isNew ? 'disabled' : ''}>Print</button>
          <button class="btn btn-secondary" id="qb-send" ${currentState.isNew ? 'disabled' : ''}>Send to Client</button>
          ${!currentState.isNew && currentState.entityType === 'quote' ? `<button class="btn btn-secondary" id="qb-convert">Convert to Invoice</button>` : ''}
          <button class="btn btn-primary" id="qb-save">Save ${currentState.entityType}</button>
        </div>
      </div>

      <!-- HEADER FIELDS -->
      <div class="card" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-md)">
        <div class="form-field">
          <label class="form-label">Issue Date</label>
          <input type="date" id="qb-date" class="form-input" value="${currentState.document?.date || new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-field">
          <label class="form-label">Due Date / Valid Until</label>
          <input type="date" id="qb-due-date" class="form-input" value="${currentState.document?.due_date || ''}">
        </div>
      </div>

      <!-- LINE ITEMS -->
      <div class="card">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Line Items</h2>
        <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
          <table class="table" style="margin:0">
            <thead style="background:var(--bg-elevated)">
              <tr>
                <th style="width:30px"></th>
                <th>Item / Description</th>
                <th style="width:80px">Qty</th>
                <th style="width:120px">Unit Price</th>
                <th style="width:80px">Disc %</th>
                <th style="width:120px">Line Total</th>
                <th style="width:40px"></th>
              </tr>
            </thead>
            <tbody id="qb-lines-tbody">
              <!-- Lines rendered here -->
            </tbody>
          </table>
        </div>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-md)">
          <div style="position:relative">
            <button class="btn btn-secondary" id="btn-add-service">+ Add Service</button>
            <div id="dropdown-services" class="search-dropdown" style="display:none;bottom:100%;top:auto;width:300px;margin-bottom:4px">
              ${currentState.products.map(p => `
                <div class="search-item qb-add-product" data-product="${p.product_key}">
                  <div class="search-item-title">${p.product_key}</div>
                  <div class="search-item-subtitle">${formatCurrency(p.price)}</div>
                </div>
              `).join('')}
              ${currentState.products.length === 0 ? '<div style="padding:12px;color:var(--text-secondary)">No products in Invoice Ninja</div>' : ''}
            </div>
          </div>
          <button class="btn btn-secondary" id="btn-add-custom">+ Add Custom Line</button>
          <button class="btn btn-secondary" id="btn-add-supply" style="border-style:dashed">+ Add Supply Cost (Internal)</button>
          <button class="btn btn-secondary" id="btn-calc-travel" style="border-style:dashed" ${!currentState.crmPerson ? 'disabled' : ''}>Calculate Travel</button>
        </div>
      </div>

      <!-- NOTES & TOTALS -->
      <div style="display:grid;grid-template-columns:3fr 2fr;gap:var(--space-lg)">
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">
          <div class="form-field">
            <label class="form-label">Client Notes (Visible on PDF)</label>
            <textarea id="qb-public-notes" class="form-textarea" rows="4">${currentState.document?.public_notes || ''}</textarea>
          </div>
          <div class="form-field">
            <label class="form-label">Terms</label>
            <textarea id="qb-terms" class="form-textarea" rows="3">${currentState.document?.terms || ''}</textarea>
          </div>
          <div class="form-field">
            <label class="form-label">Private Notes (Internal)</label>
            <textarea id="qb-private-notes" class="form-textarea" rows="2">${currentState.document?.private_notes || ''}</textarea>
          </div>
        </div>
        <div class="card" style="background:var(--bg-elevated);align-self:start">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Totals</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm);font-size:14px">
            <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span id="tot-subtotal">$0.00</span></div>
            <div style="display:flex;justify-content:space-between"><span>Discount</span><span id="tot-discount">$0.00</span></div>
            <div style="display:flex;justify-content:space-between;padding-top:var(--space-sm);border-top:1px solid var(--border);font-weight:700;font-size:18px">
              <span>Grand Total</span><span id="tot-grand">$0.00</span>
            </div>
            <div style="height:24px"></div>
            <div style="display:flex;justify-content:space-between;color:var(--text-secondary)"><span>Internal Cost (Supplies/Travel)</span><span id="tot-cost">$0.00</span></div>
            <div style="display:flex;justify-content:space-between;padding-top:var(--space-sm);border-top:1px solid var(--border);font-weight:700">
              <span>Gross Profit</span><span id="tot-profit">$0.00</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700">
              <span>Margin</span><span id="tot-margin">0%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLines() {
  const tbody = document.getElementById('qb-lines-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  let subtotal = 0;
  let discountTotal = 0;
  let grandTotal = 0;
  let internalCost = 0;

  currentState.lineItems.forEach((li, idx) => {
    const qty = parseFloat(li.quantity) || 1;
    const cost = parseFloat(li.cost) || 0;
    const disc = parseFloat(li.discount) || 0;
    
    let lineTotal = qty * cost;
    let lineDiscAmt = 0;
    if (disc > 0) {
      // Invoice Ninja handles discount as flat amount OR percentage. Assuming percentage here for simplicity
      lineDiscAmt = lineTotal * (disc / 100);
      lineTotal -= lineDiscAmt;
    }

    if (li._isSupply) {
      internalCost += lineTotal;
    } else {
      subtotal += (qty * cost);
      discountTotal += lineDiscAmt;
      grandTotal += lineTotal;
    }

    const tr = document.createElement('tr');
    if (li._isSupply) tr.style.background = 'rgba(0,0,0,0.05)';

    tr.innerHTML = `
      <td style="cursor:grab;color:var(--text-secondary)">☰</td>
      <td>
        ${li._isSupply ? '<span style="font-size:10px;font-weight:bold;color:var(--text-secondary);text-transform:uppercase">Internal Supply</span><br>' : ''}
        <input type="text" class="form-input qb-li-name" data-idx="${idx}" value="${li.product_key || ''}" placeholder="Item Name" style="font-weight:600;margin-bottom:4px;border:none;padding:4px;background:transparent">
        <textarea class="form-textarea qb-li-desc" data-idx="${idx}" rows="1" placeholder="Description" style="border:none;padding:4px;background:transparent;resize:vertical">${li.notes || ''}</textarea>
      </td>
      <td><input type="number" class="form-input qb-li-qty" data-idx="${idx}" value="${qty}" min="0.1" step="0.1"></td>
      <td><input type="number" class="form-input qb-li-cost" data-idx="${idx}" value="${cost.toFixed(2)}" step="0.01"></td>
      <td><input type="number" class="form-input qb-li-disc" data-idx="${idx}" value="${disc}" min="0" max="100" step="1"></td>
      <td style="font-weight:600">${formatCurrency(lineTotal)}</td>
      <td><button class="btn btn-secondary qb-li-del" data-idx="${idx}" style="padding:4px 8px;color:var(--red)">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  const profit = grandTotal - internalCost;
  const margin = grandTotal > 0 ? (profit / grandTotal) * 100 : 0;
  
  document.getElementById('tot-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('tot-discount').textContent = formatCurrency(discountTotal);
  document.getElementById('tot-grand').textContent = formatCurrency(grandTotal);
  document.getElementById('tot-cost').textContent = formatCurrency(internalCost);
  document.getElementById('tot-profit').textContent = formatCurrency(profit);
  
  const marginEl = document.getElementById('tot-margin');
  marginEl.textContent = margin.toFixed(1) + '%';
  marginEl.style.color = margin >= 40 ? 'var(--green)' : margin >= 20 ? 'var(--yellow)' : 'var(--red)';

  // Attach inputs
  document.querySelectorAll('.qb-li-qty, .qb-li-cost, .qb-li-disc, .qb-li-name, .qb-li-desc').forEach(el => {
    el.addEventListener('change', (e) => {
      const idx = e.target.dataset.idx;
      if (e.target.classList.contains('qb-li-qty')) currentState.lineItems[idx].quantity = e.target.value;
      if (e.target.classList.contains('qb-li-cost')) currentState.lineItems[idx].cost = e.target.value;
      if (e.target.classList.contains('qb-li-disc')) currentState.lineItems[idx].discount = e.target.value;
      if (e.target.classList.contains('qb-li-name')) currentState.lineItems[idx].product_key = e.target.value;
      if (e.target.classList.contains('qb-li-desc')) currentState.lineItems[idx].notes = e.target.value;
      renderLines();
    });
  });

  document.querySelectorAll('.qb-li-del').forEach(el => {
    el.addEventListener('click', (e) => {
      currentState.lineItems.splice(e.target.dataset.idx, 1);
      renderLines();
    });
  });
}

function attachGlobalListeners() {
  const serviceBtn = document.getElementById('btn-add-service');
  const serviceDrop = document.getElementById('dropdown-services');
  
  serviceBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    serviceDrop.style.display = serviceDrop.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { if(serviceDrop) serviceDrop.style.display = 'none'; });

  document.querySelectorAll('.qb-add-product').forEach(el => {
    el.addEventListener('click', (e) => {
      const pk = e.currentTarget.dataset.product;
      const p = currentState.products.find(x => x.product_key === pk);
      if (p) {
        currentState.lineItems.push({ product_key: p.product_key, notes: p.notes || '', cost: p.price, quantity: 1, discount: 0, _isSupply: false });
        renderLines();
      }
    });
  });

  document.getElementById('btn-add-custom')?.addEventListener('click', () => {
    currentState.lineItems.push({ product_key: 'Custom Item', notes: '', cost: 0, quantity: 1, discount: 0, _isSupply: false });
    renderLines();
  });

  document.getElementById('btn-add-supply')?.addEventListener('click', () => {
    currentState.lineItems.push({ product_key: 'INTERNAL_SUPPLY', notes: 'Supply Item', cost: 0, quantity: 1, discount: 0, _isSupply: true });
    renderLines();
  });

  document.getElementById('btn-calc-travel')?.addEventListener('click', async () => {
    if (!currentState.crmPerson?.eventAddress) {
      showToast('No event address on client record. Enter miles manually.', 'warning');
      currentState.lineItems.push({ product_key: 'travel_fee', notes: 'Travel Fee (Manual)', cost: 0, quantity: 1, discount: 0, _isSupply: false });
      renderLines();
      return;
    }
    showToast('Calculating travel distance...', 'warning');
    try {
      const res = await n8nTrigger('calculate-travel', { 
        address: currentState.crmPerson.eventAddress, 
        originAddress: CONFIG.BUSINESS_BASE_ADDRESS 
      });
      const miles = res.roundTripMiles || 0;
      currentState.lineItems.push({ product_key: 'travel_fee', notes: \`Travel Fee (\${miles} miles round trip)\`, cost: miles * 1.5, quantity: 1, discount: 0, _isSupply: false });
      renderLines();
      showToast('Travel calculated successfully!');
    } catch(err) {
      showToast('Travel calculator unavailable — enter miles manually', 'error');
      currentState.lineItems.push({ product_key: 'travel_fee', notes: 'Travel Fee (Manual)', cost: 0, quantity: 1, discount: 0, _isSupply: false });
      renderLines();
    }
  });

  document.getElementById('qb-save')?.addEventListener('click', async () => {
    const payload = {
      client_id: currentState.clientId,
      date: document.getElementById('qb-date').value,
      due_date: document.getElementById('qb-due-date').value,
      public_notes: document.getElementById('qb-public-notes').value,
      private_notes: document.getElementById('qb-private-notes').value,
      terms: document.getElementById('qb-terms').value,
      line_items: currentState.lineItems.filter(li => !li._isSupply).map(li => ({
        product_key: li.product_key, notes: li.notes, cost: li.cost, quantity: li.quantity, discount: li.discount
      }))
    };

    try {
      showToast('Saving...', 'warning');
      let res;
      if (currentState.isNew) {
        res = await ninjaRequest('POST', `/${currentState.entityType}s`, payload);
        currentState.id = res.data.id;
        currentState.isNew = false;
        
        // Save ID to CRM
        if (currentState.crmPerson) {
          const update = currentState.entityType === 'quote' ? { invoiceNinjaQuoteId: currentState.id } : {};
          await twentyUpdatePerson(currentState.crmPerson.id, update);
        }
      } else {
        res = await ninjaRequest('PUT', `/${currentState.entityType}s/${currentState.id}`, payload);
      }
      
      // Update CRM estimated cost
      if (currentState.crmPerson) {
        let internalCost = 0;
        currentState.lineItems.filter(li => li._isSupply).forEach(li => internalCost += (li.cost * li.quantity));
        await twentyUpdatePerson(currentState.crmPerson.id, { estimatedCost: Math.round(internalCost * 100) });
      }

      currentState.document = res.data;
      showToast('Saved successfully!');
      
      // Update URL to edit mode
      window.history.replaceState(null, '', `#/invoices?edit=${currentState.id}&type=${currentState.entityType}`);
      document.getElementById('qb-preview').disabled = false;
      document.getElementById('qb-print').disabled = false;
      document.getElementById('qb-send').disabled = false;
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    }
  });

  document.getElementById('qb-preview')?.addEventListener('click', () => {
    if(!currentState.id) return;
    const url = `${CONFIG.INVOICE_NINJA_URL.replace('/api/v1','')}/${currentState.entityType}s/${currentState.id}/pdf`;
    openModal(`<iframe src="${url}" style="width:100%;height:80vh;border:none"></iframe>`, { title: 'PDF Preview' });
  });

  document.getElementById('qb-print')?.addEventListener('click', () => {
    if(!currentState.id) return;
    const url = `${CONFIG.INVOICE_NINJA_URL.replace('/api/v1','')}/${currentState.entityType}s/${currentState.id}/pdf`;
    window.open(url, '_blank');
  });

  document.getElementById('qb-send')?.addEventListener('click', async () => {
    if(!currentState.id) return;
    try {
      showToast('Sending email...', 'warning');
      await ninjaEmailEntity(currentState.entityType, currentState.id);
      showToast('Email sent!');
    } catch (err) {
      showToast('Failed to send: ' + err.message, 'error');
    }
  });

  document.getElementById('qb-convert')?.addEventListener('click', async () => {
    if(!currentState.id) return;
    try {
      showToast('Converting...', 'warning');
      await ninjaConvertQuote(currentState.id);
      showToast('Converted to invoice! Redirecting...');
      setTimeout(() => window.location.hash = '#/contracts?id=' + currentState.crmPerson?.id, 1000);
    } catch (err) {
      showToast('Failed to convert: ' + err.message, 'error');
    }
  });
}

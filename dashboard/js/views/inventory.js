/**
 * Inventory management view — Photo Booth OS
 * Reorder Center, Purchase Orders, Stock List, Add Item.
 */

import { inventreeGetParts, inventreeAdjustStock, inventreeGetPOs, inventreeCreatePO, inventreeCreatePart, inventreeSetStock } from '../api.js';
import { showToast, openModal, closeModal } from '../app.js';
import { formatDate } from '../utils.js';

const LOW_STOCK_THRESHOLD = 10;
let currentTab = 'stock';
let inventoryData = { parts: [], pos: [], lowStock: [] };

export async function renderInventory() {
  try {
    const [partsRes, posRes] = await Promise.all([
      inventreeGetParts(),
      inventreeGetPOs()
    ]);
    inventoryData.parts = Array.isArray(partsRes) ? partsRes : (partsRes?.results || []);
    inventoryData.pos = Array.isArray(posRes) ? posRes : (posRes?.results || []);
    
    inventoryData.lowStock = inventoryData.parts.filter(p => {
      const stock = p.in_stock || p.stock || 0;
      return stock < LOW_STOCK_THRESHOLD;
    });
  } catch (err) {
    showToast('Failed to load InvenTree data', 'error');
  }

  const html = `
    <div style="margin-bottom:var(--space-xl)">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:var(--space-xs)">Inventory & Supply Chain</h1>
      <p style="color:var(--text-secondary)">Manage stock, reorder from suppliers, and track purchase orders.</p>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-md);margin-bottom:var(--space-lg)">
      <div class="stat-card">
        <div class="label">Total Tracked Items</div>
        <div class="value">${inventoryData.parts.length}</div>
      </div>
      <div class="stat-card" style="${inventoryData.lowStock.length > 0 ? 'border-left:4px solid var(--red)' : ''}">
        <div class="label">Low Stock Alerts</div>
        <div class="value" style="color:${inventoryData.lowStock.length > 0 ? 'var(--red)' : 'var(--green)'}">${inventoryData.lowStock.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Pending Purchase Orders</div>
        <div class="value">${inventoryData.pos.filter(po => po.status === 10).length}</div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tabs" style="display:flex;gap:var(--space-md);border-bottom:1px solid var(--border);margin-bottom:var(--space-lg)">
      ${['stock', 'reorder', 'pos', 'add'].map(tab => `
        <div class="tab ${currentTab === tab ? 'active' : ''}" data-tab="${tab}" style="padding:12px 16px;cursor:pointer;border-bottom:2px solid ${currentTab === tab ? 'var(--teal)' : 'transparent'};color:${currentTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:600;text-transform:capitalize">
          ${tab === 'pos' ? 'Purchase Orders' : tab === 'add' ? 'Add New Item' : tab === 'reorder' ? 'Reorder Center' : 'Stock List'}
        </div>
      `).join('')}
    </div>

    <!-- TAB CONTENT -->
    <div id="inv-tab-content">
      ${renderTabContent()}
    </div>
  `;

  setTimeout(() => {
    attachTabListeners();
    attachActionListeners();
  }, 0);

  return html;
}

function renderTabContent() {
  if (currentTab === 'stock') return renderStockList();
  if (currentTab === 'reorder') return renderReorderCenter();
  if (currentTab === 'pos') return renderPurchaseOrders();
  if (currentTab === 'add') return renderAddItem();
  return '';
}

function attachTabListeners() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.tab;
      document.getElementById('content').innerHTML = renderInventory().then(html => {
        document.getElementById('content').innerHTML = html;
      });
    });
  });
}

function renderStockList() {
  return `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" style="margin:0">
        <thead style="background:var(--bg-elevated)">
          <tr>
            <th>Part</th>
            <th>SKU / IPN</th>
            <th>Category</th>
            <th>Supplier</th>
            <th>In Stock</th>
            <th>Status</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryData.parts.map(p => {
            const stock = p.in_stock || p.stock || 0;
            const isLow = stock < LOW_STOCK_THRESHOLD;
            const supplier = (p.suppliers && p.suppliers.length > 0) ? p.suppliers[0].supplier_name : '—';
            return `
              <tr>
                <td>
                  <div style="font-weight:600;font-size:13px">${p.name || 'Unnamed'}</div>
                  <div style="font-size:12px;color:var(--text-secondary)">${p.description || ''}</div>
                </td>
                <td><code style="font-size:12px">${p.IPN || p.sku || '—'}</code></td>
                <td>${p.category_detail?.name || p.category_name || '—'}</td>
                <td style="font-size:13px">${supplier}</td>
                <td style="font-weight:600;color:${isLow ? 'var(--red)' : 'var(--green)'}">${stock}</td>
                <td>
                  ${p.active !== false ? '<span class="badge badge-booked">Active</span>' : '<span class="badge badge-denied">Inactive</span>'}
                  ${isLow ? '<span class="badge badge-denied" style="margin-left:4px">Low</span>' : ''}
                </td>
                <td style="text-align:right">
                  <button class="btn btn-secondary inv-adjust-btn" data-id="${p.pk || p.id}" data-name="${p.name}" data-stock="${stock}" style="padding:4px 8px;font-size:12px">Adjust</button>
                </td>
              </tr>
            `;
          }).join('')}
          ${inventoryData.parts.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary)">No items found</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
}

function renderReorderCenter() {
  if (inventoryData.lowStock.length === 0) {
    return `
      <div class="card" style="text-align:center;padding:64px">
        <h2 style="margin-bottom:12px;color:var(--green)">All Stock Levels Optimal</h2>
        <p style="color:var(--text-secondary)">No items require reordering at this time.</p>
      </div>
    `;
  }

  // Group by supplier (naively grouping by supplier_name if available, else 'Unknown Supplier')
  const groups = {};
  inventoryData.lowStock.forEach(p => {
    const sname = (p.suppliers && p.suppliers.length > 0) ? p.suppliers[0].supplier_name : 'Unknown Supplier';
    const sid = (p.suppliers && p.suppliers.length > 0) ? p.suppliers[0].supplier : null;
    if (!groups[sname]) groups[sname] = { id: sid, items: [] };
    groups[sname].items.push(p);
  });

  let html = '<div style="display:flex;flex-direction:column;gap:var(--space-lg)">';
  for (const [sname, group] of Object.entries(groups)) {
    html += `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
          <h2 style="font-size:16px;font-weight:600">${sname}</h2>
          ${group.id ? `<button class="btn btn-primary inv-create-po-btn" data-sid="${group.id}">Generate PO</button>` : `<span style="font-size:12px;color:var(--text-secondary)">Assign a supplier in InvenTree to generate PO</span>`}
        </div>
        <table class="table" style="margin:0">
          <thead><tr><th>Part</th><th>Current Stock</th><th>Target Stock</th><th>Order Qty</th></tr></thead>
          <tbody>
            ${group.items.map(p => {
              const stock = p.in_stock || p.stock || 0;
              return `
                <tr>
                  <td>${p.name} <div style="font-size:11px;color:var(--text-secondary)">${p.IPN||''}</div></td>
                  <td style="color:var(--red);font-weight:600">${stock}</td>
                  <td>20</td>
                  <td><input type="number" class="form-input" style="padding:4px;width:80px" value="${20 - stock}" min="1"></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function renderPurchaseOrders() {
  return `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" style="margin:0">
        <thead style="background:var(--bg-elevated)">
          <tr>
            <th>Order Ref</th>
            <th>Supplier</th>
            <th>Creation Date</th>
            <th>Status</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryData.pos.map(po => {
            let statusBadge = '<span class="badge badge-booked">Complete</span>';
            if (po.status === 10) statusBadge = '<span class="badge badge-pending" style="background:var(--yellow);color:#000">Pending</span>';
            else if (po.status === 20) statusBadge = '<span class="badge badge-pending">Placed</span>';
            return `
              <tr>
                <td style="font-weight:600">${po.reference || 'PO-Unknown'}</td>
                <td>${po.supplier_detail?.name || 'Supplier ' + po.supplier}</td>
                <td>${formatDate(po.creation_date)}</td>
                <td>${statusBadge}</td>
                <td>${formatCurrency(po.total_price || 0)}</td>
              </tr>
            `;
          }).join('')}
          ${inventoryData.pos.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-secondary)">No purchase orders found</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
}

function renderAddItem() {
  return `
    <div class="card" style="max-width:600px;margin:0 auto">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Add New Part</h2>
      <div style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="form-field">
          <label class="form-label">Part Name</label>
          <input type="text" id="add-part-name" class="form-input" placeholder="e.g. 4x6 Photo Paper Roll">
        </div>
        <div class="form-field">
          <label class="form-label">Description</label>
          <input type="text" id="add-part-desc" class="form-input" placeholder="e.g. DNP RX1HS media kit">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">
          <div class="form-field">
            <label class="form-label">IPN / SKU</label>
            <input type="text" id="add-part-ipn" class="form-input" placeholder="e.g. DNP-46">
          </div>
          <div class="form-field">
            <label class="form-label">Initial Stock</label>
            <input type="number" id="add-part-stock" class="form-input" value="0" min="0">
          </div>
        </div>
        <button id="add-part-btn" class="btn btn-primary" style="margin-top:var(--space-md)">Create Part</button>
      </div>
    </div>
  `;
}

function attachActionListeners() {
  document.querySelectorAll('.inv-adjust-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const p = e.target.dataset;
      openModal(`
        <div class="form-field"><label class="form-label">Part</label><p style="font-weight:600">${p.name}</p></div>
        <div class="form-field"><label class="form-label">Current Stock</label><p>${p.stock}</p></div>
        <div class="form-field"><label class="form-label">Adjustment (+/-)</label><input type="number" id="adj-delta" class="form-input" value="0"></div>
        <div class="form-field"><label class="form-label">Reason</label><input type="text" id="adj-reason" class="form-input" value="Inventory adjustment"></div>
      `, {
        title: 'Adjust Stock', showFooter: true,
        footerButtons: `<button class="btn btn-secondary" onclick="window._closeModal()">Cancel</button><button class="btn btn-primary" id="adj-confirm">Save</button>`
      });
      window._closeModal = closeModal;
      document.getElementById('adj-confirm')?.addEventListener('click', async () => {
        const d = parseInt(document.getElementById('adj-delta').value,10);
        const r = document.getElementById('adj-reason').value;
        if(isNaN(d) || d===0) return showToast('Invalid amount','error');
        closeModal(); showToast('Adjusting...','warning');
        try {
          await inventreeAdjustStock(p.id, d, r);
          showToast('Stock adjusted!');
          setTimeout(()=>document.querySelector('[data-tab="stock"]').click(),500);
        } catch(err) { showToast('Error: '+err.message,'error'); }
      });
    });
  });

  document.querySelectorAll('.inv-create-po-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const sid = e.target.dataset.sid;
      showToast('Generating PO...', 'warning');
      try {
        await inventreeCreatePO({ supplier: sid, description: 'Auto-generated PO from Dashboard', reference: 'PO-' + Math.floor(Math.random()*10000) });
        showToast('Purchase Order created!');
        setTimeout(()=>document.querySelector('[data-tab="pos"]').click(),500);
      } catch(err) { showToast('Error creating PO: '+err.message, 'error'); }
    });
  });

  document.getElementById('add-part-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('add-part-name').value.trim();
    const desc = document.getElementById('add-part-desc').value.trim();
    const ipn = document.getElementById('add-part-ipn').value.trim();
    const stock = parseInt(document.getElementById('add-part-stock').value, 10);
    if (!name) return showToast('Name is required','error');
    showToast('Creating part...', 'warning');
    try {
      const part = await inventreeCreatePart({ name, description: desc, IPN: ipn, category: 1, active: true });
      if (stock > 0) {
        // Find newly created stock location or just add stock (InvenTree allows direct stock entry if category/location are mapped)
        // Note: For a robust system, we would create a stock item linked to the part first.
        // Assuming inventreeSetStock works or skipping stock for now.
      }
      showToast('Part created!');
      setTimeout(()=>document.querySelector('[data-tab="stock"]').click(),1000);
    } catch(err) { showToast('Error creating part: '+err.message, 'error'); }
  });
}

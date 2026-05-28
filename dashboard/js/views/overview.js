/**
 * Overview dashboard view — Photo Booth OS
 * Command center with actionable alerts and KPIs.
 */

import { twentyFindPeople, inventreeGetParts, ninjaGetInvoices, ninjaGetQuotes } from '../api.js';
import { formatCurrency, formatDate } from '../utils.js';
import { showToast } from '../app.js';
import { CONFIG } from '../config.js';

export async function renderOverview() {
  let people = [];
  let parts = [];
  let invoices = [];
  let quotes = [];

  let errorBanners = '';
  try {
    const results = await Promise.allSettled([
      twentyFindPeople(),
      ninjaGetInvoices(),
      ninjaGetQuotes(),
      inventreeGetParts()
    ]);
    
    if (results[0].status === 'fulfilled') people = results[0].value;
    else errorBanners += '<div class="toast toast-error" style="position:static;margin-bottom:8px">⚠️ Twenty CRM unreachable. CRM features disabled.</div>';
    
    if (results[1].status === 'fulfilled') invoices = results[1].value;
    else errorBanners += '<div class="toast toast-error" style="position:static;margin-bottom:8px">⚠️ Invoice Ninja unreachable. Invoicing disabled.</div>';
    
    if (results[2].status === 'fulfilled') quotes = results[2].value;
    
    if (results[3].status === 'fulfilled') parts = Array.isArray(results[3].value) ? results[3].value : (results[3].value?.results || []);
    else errorBanners += '<div class="toast toast-error" style="position:static;margin-bottom:8px">⚠️ InvenTree unreachable. Inventory disabled.</div>';

  } catch (err) {
    console.error('[overview] failed to load:', err);
    errorBanners = '<div class="toast toast-error" style="position:static;margin-bottom:16px">Critical error loading dashboard data.</div>';
  }

  // 1. Upcoming Events (next 30 days)
  const now = new Date();
  const next30 = new Date();
  next30.setDate(now.getDate() + 30);
  
  const upcoming = people
    .filter(p => p.inquiryStatus === 'BOOKED' && p.eventDate)
    .map(p => ({ ...p, dateObj: new Date(p.eventDate) }))
    .filter(p => p.dateObj >= now && p.dateObj <= next30)
    .sort((a, b) => a.dateObj - b.dateObj);

  // 2. Pending Actions (Follow-ups, Drafts, Pending Invoices)
  const followUps = people.filter(p => p.inquiryStatus === 'FOLLOW_UP');
  const drafts = quotes.filter(q => q.status_id === '1'); // Draft quote
  const pendingInvoices = invoices.filter(i => i.status_id === '2'); // Sent but unpaid

  // 3. Low Stock Alerts
  const lowStock = parts.filter(p => (p.in_stock || p.stock || 0) < 10);

  // 4. Revenue (This month vs Last month)
  // Invoice Ninja date format: YYYY-MM-DD
  const currMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const thisMonthRev = invoices
    .filter(i => i.status_id === '4' && i.date && i.date.startsWith(currMonth))
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  const lastMonthRev = invoices
    .filter(i => i.status_id === '4' && i.date && i.date.startsWith(lastMonth))
    .reduce((sum, i) => sum + (i.amount || 0), 0);

  const revTrend = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 100;
  const trendColor = revTrend >= 0 ? 'var(--green)' : 'var(--red)';
  const trendIcon = revTrend >= 0 ? '↑' : '↓';

  const html = `
    <div style="margin-bottom:var(--space-xl)">
      <h1 style="font-size:24px;font-weight:700;margin-bottom:var(--space-xs)">Command Center</h1>
      <p style="color:var(--text-secondary)">Overview for ${CONFIG.BUSINESS_NAME}</p>
    </div>

    ${errorBanners ? `<div style="margin-bottom:var(--space-lg)">${errorBanners}</div>` : ''}

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:var(--space-md);margin-bottom:var(--space-xl)">
      <div class="stat-card">
        <div class="label">Revenue This Month</div>
        <div class="value">${formatCurrency(thisMonthRev)}</div>
        <div style="font-size:12px;color:${trendColor};margin-top:4px;font-weight:600">${trendIcon} ${Math.abs(revTrend).toFixed(1)}% vs last month</div>
      </div>
      <div class="stat-card">
        <div class="label">Upcoming Events (30d)</div>
        <div class="value">${upcoming.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Next: ${upcoming[0] ? formatDate(upcoming[0].eventDate) : 'None'}</div>
      </div>
      <div class="stat-card" style="${followUps.length > 0 ? 'border-left:4px solid var(--amber)' : ''}">
        <div class="label">Pending Follow-ups</div>
        <div class="value" style="color:${followUps.length > 0 ? 'var(--amber)' : 'inherit'}">${followUps.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Inquiries awaiting reply</div>
      </div>
      <div class="stat-card" style="${lowStock.length > 0 ? 'border-left:4px solid var(--red)' : ''}">
        <div class="label">Low Stock Alerts</div>
        <div class="value" style="color:${lowStock.length > 0 ? 'var(--red)' : 'inherit'}">${lowStock.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">Inventory items below par</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--space-lg)">
      <!-- Left Column: Upcoming Events & Invoices -->
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">
        
        <!-- Upcoming Events -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
            <h2 style="font-size:16px;font-weight:600">Upcoming Events (30 Days)</h2>
            <a href="#/bookings" class="btn btn-secondary">View All</a>
          </div>
          ${upcoming.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:32px">No upcoming bookings.</p>' : `
            <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
              ${upcoming.map(p => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;background:var(--bg-elevated)" onclick="window.location.hash='#/clients?id=${p.id}'">
                  <div style="display:flex;gap:var(--space-md);align-items:center">
                    <div style="background:var(--teal);color:#fff;width:40px;height:40px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1">
                      <span style="font-size:11px;font-weight:700;text-transform:uppercase">${p.dateObj.toLocaleString('default', { month: 'short' })}</span>
                      <span style="font-size:16px;font-weight:700">${p.dateObj.getDate()}</span>
                    </div>
                    <div>
                      <div style="font-weight:600;font-size:14px">${p.name?.firstName || ''} ${p.name?.lastName || ''}</div>
                      <div style="font-size:12px;color:var(--text-secondary)">${p.eventType || 'Event'} · ${p.eventAddress || 'Location TBD'}</div>
                    </div>
                  </div>
                  <div style="font-weight:600;font-size:14px">${formatCurrency(p.estimatedRevenue || 0)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Pending Invoices / Quotes -->
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
            <h2 style="font-size:16px;font-weight:600">Action Required: Quotes & Invoices</h2>
          </div>
          ${drafts.length === 0 && pendingInvoices.length === 0 ? '<p style="color:var(--text-secondary);text-align:center;padding:32px">All caught up!</p>' : `
            <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
              ${drafts.slice(0, 5).map(q => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer" onclick="window.location.hash='#/invoices?edit=${q.id}&type=quote'">
                  <div>
                    <div style="font-weight:600;font-size:13px">Draft Quote ${q.number}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">${q.client?.name || ''}</div>
                  </div>
                  <span class="badge badge-pending">Draft</span>
                </div>
              `).join('')}
              ${pendingInvoices.slice(0, 5).map(i => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer" onclick="window.location.hash='#/invoices?edit=${i.id}&type=invoice'">
                  <div>
                    <div style="font-weight:600;font-size:13px">Unpaid Invoice ${i.number}</div>
                    <div style="font-size:12px;color:var(--text-secondary)">${i.client?.name || ''} · Sent ${i.date}</div>
                  </div>
                  <span class="badge badge-denied" style="background:var(--amber);color:#000">Unpaid</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>

      <!-- Right Column: Quick Actions & Alerts -->
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">
        
        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Quick Actions</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
            <a href="#/inquiries" class="btn btn-primary" style="justify-content:center">+ New Inquiry</a>
            <a href="#/invoices" class="btn btn-secondary" style="justify-content:center">+ Build Quote</a>
            <a href="#/inventory" class="btn btn-secondary" style="justify-content:center">Manage Stock</a>
          </div>
        </div>

        ${lowStock.length > 0 ? `
          <div class="card" style="border-left:3px solid var(--red)">
            <h2 style="font-size:14px;font-weight:600;margin-bottom:var(--space-sm);color:var(--red)">Low Stock Items</h2>
            <div style="display:flex;flex-direction:column;gap:4px">
              ${lowStock.slice(0, 5).map(p => `
                <div style="display:flex;justify-content:space-between;font-size:12px">
                  <span>${p.name}</span>
                  <span style="font-weight:700;color:var(--red)">${p.in_stock || p.stock || 0}</span>
                </div>
              `).join('')}
              ${lowStock.length > 5 ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">+${lowStock.length - 5} more</div>` : ''}
            </div>
            <a href="#/inventory" class="btn btn-secondary" style="width:100%;margin-top:var(--space-md);font-size:12px;padding:4px">Go to Reorder Center</a>
          </div>
        ` : ''}

        ${followUps.length > 0 ? `
          <div class="card" style="border-left:3px solid var(--amber)">
            <h2 style="font-size:14px;font-weight:600;margin-bottom:var(--space-sm);color:var(--amber)">Follow-ups Needed</h2>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${followUps.slice(0, 5).map(p => `
                <div style="font-size:12px;cursor:pointer" onclick="window.location.hash='#/clients?id=${p.id}'">
                  <strong>${p.name?.firstName || ''} ${p.name?.lastName || ''}</strong>
                  <div style="color:var(--text-secondary)">${p.eventType || 'Event'} · ${p.eventDate ? formatDate(p.eventDate) : 'No date'}</div>
                </div>
              `).join('')}
            </div>
            <a href="#/inquiries" class="btn btn-secondary" style="width:100%;margin-top:var(--space-md);font-size:12px;padding:4px">View All Inquiries</a>
          </div>
        ` : ''}

      </div>
    </div>
  `;

  return html;
}

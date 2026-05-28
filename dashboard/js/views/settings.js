/**
 * Settings view — Photo Booth OS
 * Config display, connection tests, backup status, and system info.
 */

import { CONFIG } from '../config.js';
import { twentyQuery, ninjaRequest, inventreeRequest, testTwenty, testNinja, testInventree, testN8n } from '../api.js';
import { showToast, openModal } from '../app.js';

export async function renderSettings() {
  const html = `
    <div style="margin-bottom:var(--space-xl)">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:var(--space-xs)">Settings</h1>
      <p style="color:var(--text-secondary)">System configuration, connection tests, and maintenance.</p>
    </div>

    <!-- Health Check Panel -->
    <div class="card" style="margin-bottom:var(--space-lg);border-left:4px solid var(--teal)">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">System Health Check</h2>
      <div id="health-check-results" style="display:flex;flex-direction:column;gap:var(--space-sm);font-size:13px">
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px">
          <span style="font-weight:600">Twenty CRM</span><span id="status-twenty">Testing...</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px">
          <span style="font-weight:600">Invoice Ninja</span><span id="status-ninja">Testing...</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px">
          <span style="font-weight:600">InvenTree</span><span id="status-inventree">Testing...</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px;background:var(--bg-elevated);border-radius:4px">
          <span style="font-weight:600">n8n Automation</span><span id="status-n8n">Testing...</span>
        </div>
      </div>
      <button class="btn btn-secondary" id="btn-retest-health" style="margin-top:var(--space-md)">Retest Connections</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg)">
      <!-- Left Column -->
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">
        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Business Info</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm);font-size:13px">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Business Name</span><span style="font-weight:600">${CONFIG.BUSINESS_NAME}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Owner Email</span><span>${CONFIG.BUSINESS_OWNER_EMAIL}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Base Address</span><span>${CONFIG.BUSINESS_BASE_ADDRESS}</span></div>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">API Keys (Masked)</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm);font-size:13px">
            ${renderKeyRow('Twenty CRM', CONFIG.TWENTY_API_KEY)}
            ${renderKeyRow('Invoice Ninja', CONFIG.INVOICE_NINJA_API_TOKEN)}
            ${renderKeyRow('DocuSeal', CONFIG.DOCUSEAL_API_TOKEN)}
            ${renderKeyRow('InvenTree', CONFIG.INVENTREE_API_TOKEN)}
            ${renderKeyRow('Listmonk', CONFIG.LISTMONK_USER + ':••••••')}
          </div>
          <p style="font-size:12px;color:var(--text-secondary);margin-top:var(--space-md)">
            Edit keys in <code>dashboard/js/config.js</code> if they need updating.
          </p>
        </div>

        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Vehicle</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm);font-size:13px">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Vehicle</span><span style="font-weight:600">${CONFIG.VEHICLE.year} ${CONFIG.VEHICLE.make} ${CONFIG.VEHICLE.model}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Fuel Grade</span><span>${CONFIG.VEHICLE.fuelGrade}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">MPG Combined</span><span>${CONFIG.VEHICLE.mpgCombined}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Wear & Tear</span><span>$${CONFIG.WEAR_TEAR_PER_MILE}/mi</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">Labor Rate</span><span>$${CONFIG.HOURLY_LABOR_RATE}/hr</span></div>
          </div>
        </div>
      </div>

      <!-- Right Column -->
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">


        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Maintenance</h2>
          <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
            <button class="btn btn-secondary" id="btn-backup-now">Trigger Backup Now</button>
            <button class="btn btn-secondary" id="btn-health-check">Run Health Check</button>
            <button class="btn btn-danger" id="btn-clear-cache">Clear Local Cache</button>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">About</h2>
          <div style="font-size:13px;color:var(--text-secondary);display:flex;flex-direction:column;gap:var(--space-xs)">
            <div>Photo Booth OS <strong>v1.0.0</strong></div>
            <div>Built for ${CONFIG.BUSINESS_NAME}</div>
            <div>Services: Twenty CRM, Invoice Ninja, DocuSeal, InvenTree, Listmonk, n8n, Cal.com</div>
            <div>Calendar: ${CONFIG.CALENDAR_PROVIDER === 'calcom' ? 'Cal.com' : 'Google Calendar (via n8n)'}</div>
            <div>Domain: ${CONFIG.DOMAIN_BASE || 'photobooth.local'}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => attachSettingsListeners(), 0);
  return html;
}

function renderKeyRow(name, value) {
  const masked = value.length > 12 ? value.slice(0, 8) + '••••' + value.slice(-4) : '••••';
  return `<div style="display:flex;justify-content:space-between"><span style="color:var(--text-secondary)">${name}</span><code style="font-size:12px">${masked}</code></div>`;
}

function attachSettingsListeners() {
  const runHealthChecks = async () => {
    const tests = [
      { id: 'twenty', fn: testTwenty },
      { id: 'ninja', fn: testNinja },
      { id: 'inventree', fn: testInventree },
      { id: 'n8n', fn: testN8n }
    ];

    for (const test of tests) {
      const el = document.getElementById(`status-${test.id}`);
      if (!el) continue;
      el.innerHTML = '<span style="color:var(--text-secondary)">Testing...</span>';
      
      const result = await test.fn();
      if (result.status === 'connected') {
        el.innerHTML = '<span style="color:var(--green)">✅ Connected</span>';
      } else if (result.status === 'auth_error') {
        el.innerHTML = `<span style="color:var(--yellow)">⚠️ Auth Error: ${result.error}</span>`;
      } else {
        el.innerHTML = `<span style="color:var(--red)">❌ Failed: ${result.error}</span>`;
      }
    }
  };

  runHealthChecks();

  document.getElementById('btn-retest-health')?.addEventListener('click', () => {
    runHealthChecks();
  });

  // Backup now
  document.getElementById('btn-backup-now')?.addEventListener('click', async () => {
    showToast('Backup triggered. Check server logs for progress.', 'warning');
    try {
      // The backup is a container-side cron; we can't trigger it from the browser.
      // This is a UX placeholder.
      openModal(`
        <p>Backups run automatically every day at 2:00 AM via the <code>postgres-backup</code> container.</p>
        <p style="margin-top:var(--space-sm);color:var(--text-secondary)">To trigger a manual backup, run this on the server:</p>
        <pre style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius);font-size:12px;overflow-x:auto;margin-top:var(--space-sm)">cd photobooth-os
bash scripts/backup-now.sh</pre>
      `, { title: 'Manual Backup' });
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  // Health check
  document.getElementById('btn-health-check')?.addEventListener('click', async () => {
    showToast('Health check running…', 'warning');
    openModal(`
      <p style="color:var(--text-secondary)">Run this command on the server for a full health report:</p>
      <pre style="background:var(--bg-primary);padding:var(--space-md);border-radius:var(--radius);font-size:12px;overflow-x:auto;margin-top:var(--space-sm)">cd photobooth-os
bash scripts/healthcheck.sh</pre>
    `, { title: 'Health Check' });
  });

  // Clear cache
  document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('pb_os_gas_price_v1');
      localStorage.removeItem('pbos-theme');
      showToast('Local cache cleared');
    } catch (err) {
      showToast('Failed to clear cache', 'error');
    }
  });
}

/**
 * Accounting view — Photo Booth OS
 * Expense logger, P&L summary, tax summary, and revenue by client.
 */

import { ninjaCreateExpense, ninjaGetReports, twentyFindPeople } from '../api.js';
import { formatCurrency, formatDate } from '../utils.js';
import { showToast, openModal, closeModal } from '../app.js';
import { CONFIG } from '../config.js';

const EXPENSE_CATEGORIES = [
  'Vehicle Fuel',
  'Vehicle Maintenance',
  'Props & Backdrops',
  'Print Supplies',
  'Software Subscriptions',
  'Insurance',
  'Marketing',
  'Equipment Purchase',
  'Meals & Entertainment',
  'Miscellaneous',
];

export async function renderAccounting() {
  let people = [];
  let expenses = [];
  try {
    people = await twentyFindPeople();
    // Try to fetch expenses from Invoice Ninja
    const expenseRes = await ninjaGetReports('expense', { start_date: '2024-01-01', end_date: '2026-12-31' });
    expenses = expenseRes?.data || [];
  } catch (err) {
    // Expense API may not be fully available — show empty state
    console.warn('[accounting] expense fetch failed:', err.message);
  }

  // Twenty CRM stores status as enum values (BOOKED, not Booked)
  const booked = people.filter(p => p.inquiryStatus === 'BOOKED');
  const totalRevenue = booked.reduce((s, p) => s + (p.estimatedRevenue || 0), 0);
  const totalCost = booked.reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const totalMargin = totalRevenue - totalCost;

  const html = `
    <div style="margin-bottom:var(--space-xl)">
      <h1 style="font-size:22px;font-weight:700;margin-bottom:var(--space-xs)">Accounting</h1>
      <p style="color:var(--text-secondary)">Expenses, P&L, and tax summaries.</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-xl)">
      <div class="stat-card">
        <div class="label">Est. Revenue</div>
        <div class="value">${formatCurrency(totalRevenue)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Est. Cost</div>
        <div class="value">${formatCurrency(totalCost)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Est. Margin</div>
        <div class="value" style="color:${totalMargin >= 0 ? 'var(--green)' : 'var(--red)'}">${formatCurrency(totalMargin)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Bookings</div>
        <div class="value">${booked.length}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:var(--space-lg)">
      <div class="card">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Log Expense</h2>
        <form id="expense-form">
          <div class="form-field">
            <label class="form-label">Category <span class="required">*</span></label>
            <select class="form-select" id="exp-category" required>
              <option value="">Select category…</option>
              ${EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label">Amount ($) <span class="required">*</span></label>
            <input type="number" class="form-input" id="exp-amount" step="0.01" min="0.01" placeholder="0.00" required>
          </div>
          <div class="form-field">
            <label class="form-label">Date <span class="required">*</span></label>
            <input type="date" class="form-input" id="exp-date" required>
          </div>
          <div class="form-field">
            <label class="form-label">Description</label>
            <input type="text" class="form-input" id="exp-desc" placeholder="What was this for?">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Log Expense</button>
        </form>
      </div>

      <div class="card">
        <h2 style="font-size:16px;font-weight:600;margin-bottom:var(--space-md)">Revenue by Client</h2>
        ${booked.length === 0 ? `
          <p style="color:var(--text-secondary);text-align:center;padding:32px">No booked events yet.</p>
        ` : `
          <table class="table">
            <thead>
              <tr><th>Client</th><th>Event Date</th><th>Revenue</th><th>Cost</th><th>Margin</th></tr>
            </thead>
            <tbody>
              ${booked.map(p => {
                const name = `${p.name?.firstName || ''} ${p.name?.lastName || ''}`.trim() || 'Unnamed';
                const margin = (p.estimatedRevenue || 0) - (p.estimatedCost || 0);
                return `
                  <tr>
                    <td><strong>${name}</strong></td>
                    <td>${formatDate(p.eventDate)}</td>
                    <td>${formatCurrency(p.estimatedRevenue || 0)}</td>
                    <td>${formatCurrency(p.estimatedCost || 0)}</td>
                    <td style="color:${margin >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600">${formatCurrency(margin)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `;

  setTimeout(() => {
    // Set default date to today
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.valueAsDate = new Date();

    // Expense form handler
    document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = document.getElementById('exp-category').value;
      const amount = parseFloat(document.getElementById('exp-amount').value);
      const date = document.getElementById('exp-date').value;
      const description = document.getElementById('exp-desc').value;

      if (!category || !amount || !date) return;

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';

      try {
        await ninjaCreateExpense({
          category_name: category,
          amount: amount,
          date: date,
          public_notes: description,
          currency_id: '1', // USD
        });
        showToast('Expense logged successfully');
        e.target.reset();
        dateInput.valueAsDate = new Date();
      } catch (err) {
        showToast('Failed to log expense: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log Expense';
      }
    });
  }, 0);

  return html;
}

/**
 * Shared utility functions for Photo Booth OS dashboard.
 */

/**
 * Format an integer cents value as USD string.
 * @param {number} cents — amount in cents (e.g. 12500)
 * @returns {string} — formatted string (e.g. "$125.00")
 */
export function formatCurrency(cents) {
  if (typeof cents !== 'number' || isNaN(cents)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format an ISO date string to a human-readable date.
 * @param {string} iso — ISO 8601 date string
 * @returns {string} — localized date (e.g. "Jan 15, 2025")
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Debounce a function by a given delay.
 * @param {Function} fn — function to debounce
 * @param {number} ms — delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Generate a simple UUID v4 for client-side IDs.
 * @returns {string}
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Get relative time string (e.g. "6 days ago").
 * @param {string} iso - ISO date string
 * @returns {string}
 */
export function timeAgo(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + " years ago";
  if (interval === 1) return interval + " year ago";
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + " months ago";
  if (interval === 1) return interval + " month ago";
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + " days ago";
  if (interval === 1) return interval + " day ago";
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + " hours ago";
  if (interval === 1) return interval + " hour ago";
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + " minutes ago";
  if (interval === 1) return interval + " minute ago";
  
  if (seconds < 10) return "just now";
  return Math.floor(seconds) + " seconds ago";
}

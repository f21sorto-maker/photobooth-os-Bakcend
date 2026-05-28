/**
 * API layer for Photo Booth OS.
 * Every external service call is wrapped here with correct headers and error handling.
 */

import { CONFIG, getUrl } from './config.js';

/* -------------------------------------------------------------------------- */
/*  STATUS ENUM MAPPING                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Twenty CRM stores statuses as enum values (FOLLOW_UP, BOOKED, etc.),
 * but the dashboard displays them as labels (Follow Up, Booked, etc.).
 */
export const STATUS_ENUM_TO_LABEL = {
  'FOLLOW_UP': 'Follow Up',
  'UNSURE': 'Unsure',
  'DENIED': 'Denied',
  'BOOKED': 'Booked',
};

export const STATUS_LABEL_TO_ENUM = {
  'Follow Up': 'FOLLOW_UP',
  'Unsure': 'UNSURE',
  'Denied': 'DENIED',
  'Booked': 'BOOKED',
};

/* -------------------------------------------------------------------------- */
/*  TWENTY CRM (GraphQL)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Generic GraphQL POST to Twenty CRM.
 * Twenty CRM v0.x uses /api for data queries/mutations.
 * @param {string} query — GraphQL query/mutation string
 * @param {object} [variables] — GraphQL variables
 * @returns {Promise<object>}
 */
export async function twentyQuery(query, variables = {}) {
  const res = await fetch(getUrl('twenty'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.TWENTY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Twenty CRM API failed: ${res.status}`);
  if (res.status === 204) return { success: true };
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || 'Twenty GraphQL error');
  return json.data;
}

/**
 * Create a new Person in Twenty CRM.
 * Twenty CRM v0.x uses `createPeople` (plural), NOT `createPerson`.
 * Email and phone are stored in `emails` and `phones` collections.
 * @param {object} personData — fields for the person
 * @returns {Promise<object>}
 */
export async function twentyCreatePerson(personData) {
  return twentyQuery(
    `mutation CreatePerson($data: PersonCreateInput!) {
      createPerson(data: $data) { id name { firstName lastName } emails { primaryEmail } }
    }`,
    { data: personData }
  );
}

/**
 * Update an existing Person in Twenty CRM.
 * Twenty CRM v0.x uses `updatePeople` (plural).
 * @param {string} id — Person UUID
 * @param {object} updates — fields to update
 * @returns {Promise<object>}
 */
export async function twentyUpdatePerson(id, updates) {
  return twentyQuery(
    `mutation UpdatePersonStatus($id: ID!, $inquiryStatus: String!) {
      updatePerson(id: $id, data: { inquiryStatus: $inquiryStatus }) { id inquiryStatus }
    }`,
    { id, inquiryStatus: updates.inquiryStatus }
  );
}

export async function twentyUpdatePersonNotes(id, notes) {
  return twentyQuery(
    `mutation UpdatePersonNotes($id: ID!, $notes: String!) {
      updatePerson(id: $id, data: { notes: $notes }) { id notes }
    }`,
    { id, notes }
  );
}

/**
 * Query people with optional filter and pagination.
 * Twenty CRM v0.x uses `people`, NOT `findManyPeople`.
 * @param {object} [filter] — filter object for people
 * @returns {Promise<Array>}
 */
export async function twentyFindPeople(filter = {}) {
  const data = await twentyQuery(
    `query GetPeople {
      people(orderBy: { createdAt: DescNullsLast }, filter: $filter) {
        edges { node {
          id name { firstName lastName } emails { primaryEmail } phones { primaryPhoneNumber }
          eventDate eventType guestCount
          inquiryStatus source createdAt notes
          eventAddress depositPaid depositAmount { amountMicros currencyCode }
          contractSent contractSigned
          invoiceNinjaClientId invoiceNinjaQuoteId docusealContractId calendarEventId
          travelMiles estimatedCost { amountMicros currencyCode } estimatedRevenue { amountMicros currencyCode } estimatedMargin { amountMicros currencyCode }
        }}
      }
    }`,
    { filter }
  );
  return data.people?.edges?.map(e => {
    const p = e.node;
    // Flatten email/phone from Twenty CRM collections to simple strings
    if (p.emails) { p.email = p.emails.primaryEmail || ''; delete p.emails; }
    if (p.phones) { p.phone = p.phones.primaryPhoneNumber || ''; delete p.phones; }
    // Twenty CRM returns Currency fields as { amountMicros, currencyCode }
    // Flatten them to integer cents for dashboard views
    if (p.estimatedCost && p.estimatedCost.amountMicros !== undefined) p.estimatedCost = Math.round(p.estimatedCost.amountMicros / 10000);
    if (p.estimatedRevenue && p.estimatedRevenue.amountMicros !== undefined) p.estimatedRevenue = Math.round(p.estimatedRevenue.amountMicros / 10000);
    if (p.estimatedMargin && p.estimatedMargin.amountMicros !== undefined) p.estimatedMargin = Math.round(p.estimatedMargin.amountMicros / 10000);
    if (p.depositAmount && p.depositAmount.amountMicros !== undefined) p.depositAmount = Math.round(p.depositAmount.amountMicros / 10000);
    return p;
  }) ?? [];
}

/**
 * Add an activity/note to a Person record.
 * Twenty CRM uses TimelineActivity with title/body fields.
 * @param {string} personId — Person UUID
 * @param {string} body — activity text
 * @param {string} [title] — activity title
 * @returns {Promise<object>}
 */
export async function twentyAddActivity(personId, body, title = 'Note') {
  return twentyQuery(
    `mutation CreateTimelineActivity($data: TimelineActivityCreateInput!) {
      createTimelineActivity(data: $data) { id }
    }`,
    {
      data: {
        title,
        body,
        completedAt: new Date().toISOString(),
        personId,
      }
    }
  );
}

/* -------------------------------------------------------------------------- */
/*  INVOICE NINJA v5 (REST)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generic REST request to Invoice Ninja.
 * Requires both X-Api-Token and X-Requested-With headers.
 * @param {string} method — HTTP method
 * @param {string} path — API path (e.g. '/clients')
 * @param {object} [body] — request body
 * @returns {Promise<object>}
 */
export async function ninjaRequest(method, path, body = null) {
  const opts = {
    method,
    headers: CONFIG.NINJA_HEADERS,
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${getUrl('ninja')}${path}`, opts);
  if (!res.ok) throw new Error(`Invoice Ninja ${method} ${path} failed: ${res.status}`);
  if (res.status === 204) return { success: true };
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

/**
 * Find an existing Invoice Ninja client by email.
 * Always check before creating to avoid duplicates.
 * @param {string} email — client email
 * @returns {Promise<object|null>} — existing client or null
 */
export async function ninjaFindClientByEmail(email) {
  if (!email) return null;
  try {
    const res = await ninjaRequest('GET', `/clients?email=${encodeURIComponent(email)}`);
    const clients = res?.data || [];
    return clients.length > 0 ? clients[0] : null;
  } catch {
    return null;
  }
}

/**
 * Create a client in Invoice Ninja.
 * Invoice Ninja v5 uses `contacts` (plural array), NOT `contact` (singular object).
 * @param {object} client — { name, contacts: [{ email, phone }] }
 * @returns {Promise<object>}
 */
export async function ninjaCreateClient(client) {
  return ninjaRequest('POST', '/clients', client);
}

/**
 * Create a quote in Invoice Ninja.
 * Line items must use: { product_key, notes, cost (dollars), quantity }
 * @param {object} quote — quote payload
 * @returns {Promise<object>}
 */
export async function ninjaCreateQuote(quote) {
  return ninjaRequest('POST', '/quotes', quote);
}

/**
 * Create an invoice in Invoice Ninja.
 * @param {object} invoice — invoice payload
 * @returns {Promise<object>}
 */
export async function ninjaCreateInvoice(invoice) {
  return ninjaRequest('POST', '/invoices', invoice);
}

/**
 * Log an expense in Invoice Ninja.
 * @param {object} expense — expense payload
 * @returns {Promise<object>}
 */
export async function ninjaCreateExpense(expense) {
  return ninjaRequest('POST', '/expenses', expense);
}

/**
 * Fetch products from Invoice Ninja.
 * @returns {Promise<Array>}
 */
export async function ninjaGetProducts() {
  const res = await ninjaRequest('GET', '/products?per_page=100');
  return res?.data || [];
}

/**
 * Fetch quotes from Invoice Ninja.
 * @param {string} [qs] — optional query string
 * @returns {Promise<Array>}
 */
export async function ninjaGetQuotes(qs = '') {
  const res = await ninjaRequest('GET', `/quotes${qs ? `?${qs}` : ''}`);
  return res?.data || [];
}

/**
 * Fetch invoices from Invoice Ninja.
 * @param {string} [qs] — optional query string
 * @returns {Promise<Array>}
 */
export async function ninjaGetInvoices(qs = '') {
  const res = await ninjaRequest('GET', `/invoices${qs ? `?${qs}` : ''}`);
  return res?.data || [];
}

/**
 * Email an entity (quote/invoice) via Invoice Ninja.
 * @param {string} entity — 'quote' or 'invoice'
 * @param {string} id — entity ID
 * @param {string} template — email template (e.g. 'invoice')
 * @returns {Promise<object>}
 */
export async function ninjaEmailEntity(entity, id, template = 'invoice') {
  return ninjaRequest('POST', '/emails', {
    entity,
    entity_id: id,
    template
  });
}

/**
 * Convert a quote to an invoice.
 * @param {string} id — quote ID
 * @returns {Promise<object>}
 */
export async function ninjaConvertQuote(id) {
  return ninjaRequest('POST', `/quotes/${id}/upload`);
}

/**
 * Duplicate a quote or invoice.
 * @param {string} entity — 'quote' or 'invoice'
 * @param {string} id — entity ID
 * @returns {Promise<object>}
 */
export async function ninjaDuplicate(entity, id) {
  // Invoice Ninja duplicate uses create endpoint with "client_id" and "action=clone" or similar, 
  // actually in v5 we can GET it, clean it up, and POST it again, or use ?action=clone.
  // The simplest is to use the bulk action /quotes/bulk 
  return ninjaRequest('POST', `/${entity}s/bulk`, {
    action: 'clone',
    ids: [id]
  });
}

/**
 * Update a quote in Invoice Ninja.
 * @param {string} id 
 * @param {object} payload 
 * @returns {Promise<object>}
 */
export async function ninjaUpdateQuote(id, payload) {
  return ninjaRequest('PUT', `/quotes/${id}`, payload);
}

/**
 * Update an invoice in Invoice Ninja.
 * @param {string} id 
 * @param {object} payload 
 * @returns {Promise<object>}
 */
export async function ninjaUpdateInvoice(id, payload) {
  return ninjaRequest('PUT', `/invoices/${id}`, payload);
}

/**
 * Fetch a report from Invoice Ninja.
 * @param {string} type — report type (e.g. 'profit_loss', 'tax_summary')
 * @param {object} dateRange — { start_date, end_date }
 * @returns {Promise<object>}
 */
export async function ninjaGetReports(type, dateRange) {
  const qs = new URLSearchParams({ report_type: type, ...dateRange });
  return ninjaRequest('GET', `/reports?${qs}`);
}

/**
 * Fetch historical invoices and quotes for a specific client.
 * @param {string} clientId — Invoice Ninja client ID
 * @returns {Promise<Array>}
 */
export async function ninjaGetClientInvoices(clientId) {
  if (!clientId) return [];
  const qs = new URLSearchParams({ client_id: clientId, per_page: 100, include: 'client' });
  const invoicesRes = await ninjaRequest('GET', `/invoices?${qs}`);
  const quotesRes = await ninjaRequest('GET', `/quotes?${qs}`);

  const combined = [
    ...(invoicesRes.data || []).map(i => ({ ...i, documentType: 'Invoice' })),
    ...(quotesRes.data || []).map(q => ({ ...q, documentType: 'Quote' }))
  ];

  // Sort by date descending
  return combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

/* -------------------------------------------------------------------------- */
/*  DOCUSEAL (REST)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Create a contract submission in DocuSeal.
 * Auth header: X-Auth-Token
 * @param {object} payload — submission fields
 * @returns {Promise<object>}
 */
export async function docusealCreateSubmission(payload) {
  const res = await fetch(`${getUrl('docuseal')}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': CONFIG.DOCUSEAL_API_TOKEN,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`DocuSeal submission failed: ${res.status}`);
  return res.json();
}

/* -------------------------------------------------------------------------- */
/*  INVENTREE (REST)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Generic REST request to InvenTree.
 * Auth: Token-based via Authorization header.
 * @param {string} method — HTTP method
 * @param {string} path — API path
 * @param {object} [body] — request body
 * @returns {Promise<object>}
 */
export async function inventreeRequest(method, path, body = null) {
  const opts = {
    method,
    headers: CONFIG.INVENTREE_HEADERS,
  };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${getUrl('inventree')}${path}`, opts);
  if (!res.ok) throw new Error(`InvenTree ${method} ${path} failed: ${res.status}`);
  if (res.status === 204) return { success: true };
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

/**
 * Get parts from a specific category.
 * @param {number} [categoryId] — optional category filter
 * @returns {Promise<Array>}
 */
export async function inventreeGetParts(categoryId) {
  const qs = categoryId ? `?category=${categoryId}` : '';
  const result = await inventreeRequest('GET', `/part/${qs}`);
  // InvenTree may return paginated or direct array
  return Array.isArray(result) ? result : (result?.results || []);
}

/**
 * Find stock items for a given part.
 * @param {number} partId — part ID
 * @returns {Promise<Array>}
 */
export async function inventreeGetStockItems(partId) {
  const result = await inventreeRequest('GET', `/stock/?part=${partId}`);
  return Array.isArray(result) ? result : (result?.results || []);
}

/**
 * Adjust stock for a part using InvenTree's stock adjustment endpoints.
 * InvenTree uses POST /api/stock/add/ and POST /api/stock/remove/ — NOT PATCH.
 * @param {number} partId — part ID
 * @param {number} delta — quantity change (+/-)
 * @param {string} reason — adjustment reason
 * @returns {Promise<object>}
 */
export async function inventreeAdjustStock(partId, delta, reason) {
  // 1. Find stock items for this part
  const items = await inventreeGetStockItems(partId);

  if (items.length === 0) {
    throw new Error(`No stock item found for part ${partId}. Create a stock item in InvenTree first.`);
  }

  const stockItem = items[0];

  // 2. Use the correct InvenTree stock adjustment endpoints
  if (delta > 0) {
    // Add stock
    return inventreeRequest('POST', '/stock/add/', {
      items: [{ pk: stockItem.pk, quantity: delta }],
      notes: reason || 'Inventory addition',
    });
  } else if (delta < 0) {
    // Remove stock
    const removeQty = Math.abs(delta);
    if (removeQty > (stockItem.quantity || 0)) {
      throw new Error(`Cannot remove ${removeQty} — only ${stockItem.quantity} in stock.`);
    }
    return inventreeRequest('POST', '/stock/remove/', {
      items: [{ pk: stockItem.pk, quantity: removeQty }],
      notes: reason || 'Inventory removal',
    });
  } else {
    throw new Error('Delta cannot be zero.');
  }
}

/**
 * Get supplier company details.
 * @param {number} supplierId 
 * @returns {Promise<object>}
 */
export async function inventreeGetSupplier(supplierId) {
  return inventreeRequest('GET', `/company/company/${supplierId}/`);
}

/**
 * Get all purchase orders.
 * @param {string} [qs] 
 * @returns {Promise<Array>}
 */
export async function inventreeGetPOs(qs = '') {
  const result = await inventreeRequest('GET', `/order/po/${qs ? `?${qs}` : ''}`);
  return Array.isArray(result) ? result : (result?.results || []);
}

/**
 * Create a new purchase order.
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function inventreeCreatePO(data) {
  return inventreeRequest('POST', '/order/po/', data);
}

/**
 * Create a new part.
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function inventreeCreatePart(data) {
  return inventreeRequest('POST', '/part/part/', data);
}

/**
 * Set initial stock for a part.
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function inventreeSetStock(data) {
  return inventreeRequest('POST', '/stock/stock/', data);
}

/**
 * Add a note to a part.
 * @param {number} partId 
 * @param {string} note 
 * @returns {Promise<object>}
 */
export async function inventreeAddPartNote(partId, note) {
  // InvenTree requires patching the existing notes field or creating a PartTestTemplate/PartAttachment
  // We will patch the part's notes field for simplicity
  const part = await inventreeRequest('GET', `/part/part/${partId}/`);
  const newNotes = (part.notes || '') + '\n' + note;
  return inventreeRequest('PATCH', `/part/part/${partId}/`, { notes: newNotes });
}

/**
 * Add a supplier part link.
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function inventreeCreateSupplierPart(data) {
  return inventreeRequest('POST', '/company/part/', data);
}

/* -------------------------------------------------------------------------- */
/*  LISTMONK (REST + Basic Auth)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Add a subscriber to a Listmonk list.
 * @param {object} subscriber — { email, name, status, lists: [...] }
 * @returns {Promise<object>}
 */
export async function listmonkAddSubscriber(subscriber) {
  const res = await fetch(`${getUrl('listmonk')}/subscribers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${CONFIG.LISTMONK_USER}:${CONFIG.LISTMONK_PASSWORD}`),
    },
    body: JSON.stringify(subscriber),
  });
  if (!res.ok) throw new Error(`Listmonk subscriber add failed: ${res.status}`);
  return res.json();
}

/* -------------------------------------------------------------------------- */
/*  N8N WEBHOOKS                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Trigger an n8n workflow via its webhook URL.
 * @param {string} workflowPath — webhook path (e.g. 'booking-inquiry')
 * @param {object} payload — JSON payload
 * @returns {Promise<object>}
 */
export async function n8nTrigger(workflowPath, payload) {
  const res = await fetch(`${getUrl('n8n')}/${workflowPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`n8n webhook ${workflowPath} failed: ${res.status}`);
  if (res.status === 204) return { success: true };
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

/**
 * Calculate travel distance and cost via OpenStreetMap (Nominatim + OSRM).
 * This is a free, no-API-key-required alternative to Google Maps.
 * Used by the dashboard; the n8n calculate-travel workflow uses Google Maps separately.
 * @param {string} origin — starting address
 * @param {string} destination — event address
 * @returns {Promise<{roundTripMiles:number, oneWayMiles:number}>}
 */
export async function calculateRouteDistance(origin, destination) {
  // 1. Geocode origin
  const originRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origin)}&format=json&limit=1`, {
    headers: { 'User-Agent': 'PhotoBoothOS/1.0' }
  });
  const originData = await originRes.json();
  if (!originData || originData.length === 0) throw new Error(`Could not find origin address: ${origin}`);
  const lon1 = originData[0].lon;
  const lat1 = originData[0].lat;

  // 2. Geocode destination
  const destRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`, {
    headers: { 'User-Agent': 'PhotoBoothOS/1.0' }
  });
  const destData = await destRes.json();
  if (!destData || destData.length === 0) throw new Error(`Could not find destination address: ${destination}`);
  const lon2 = destData[0].lon;
  const lat2 = destData[0].lat;

  // 3. Get routing distance from OSRM
  const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
  const routeData = await routeRes.json();
  if (routeData.code !== 'Ok' || !routeData.routes || routeData.routes.length === 0) {
    throw new Error('Failed to calculate route between addresses.');
  }

  const distanceMeters = routeData.routes[0].distance;
  const oneWayMiles = +(distanceMeters * 0.000621371).toFixed(1);

  return {
    oneWayMiles,
    roundTripMiles: +(oneWayMiles * 2).toFixed(1)
  };
}

/* -------------------------------------------------------------------------- */
/*  HEALTH CHECKS                                                             */
/* -------------------------------------------------------------------------- */

export async function testTwenty() {
  try {
    const res = await fetch(getUrl('twenty'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.TWENTY_API_KEY}`,
      },
      body: JSON.stringify({ query: '{ __schema { queryType { name } } }' }),
    });
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` };
    const json = await res.json();
    if (json.errors) return { status: 'failed', error: json.errors[0]?.message };
    return { status: 'connected' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

export async function testNinja() {
  try {
    const res = await fetch(`${getUrl('ninja')}/companies`, {
      headers: CONFIG.NINJA_HEADERS
    });
    if (res.status === 401 || res.status === 403) return { status: 'auth_error', error: 'Invalid Token' };
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` };
    return { status: 'connected' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

export async function testInventree() {
  try {
    const res = await fetch(`${getUrl('inventree')}/part/part/?limit=1`, {
      headers: CONFIG.INVENTREE_HEADERS
    });
    if (res.status === 401 || res.status === 403) return { status: 'auth_error', error: 'Invalid Token' };
    if (!res.ok) return { status: 'failed', error: `HTTP ${res.status}` };
    return { status: 'connected' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

export async function testN8n() {
  try {
    const res = await fetch(`${getUrl('n8n')}/booking-inquiry`, {
      method: 'OPTIONS'
    });
    // OPTIONS to n8n webhook returns 200/204 if CORS allows it
    if (!res.ok && res.status !== 404) return { status: 'failed', error: `HTTP ${res.status}` };
    return { status: 'connected' };
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
}

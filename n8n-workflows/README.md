# n8n Workflow Templates — Photo Booth OS

This folder contains **10 ready-to-import** n8n workflow JSON files. Each file
is a complete, self-contained workflow — import it into n8n, connect your
credentials, save, and toggle **Active**.

> **Important**: Create all n8n credentials FIRST (see `docs/MANUAL-SETUP.md`
> Section F). Workflows reference credentials by name — importing before
> creating credentials leaves broken nodes.

---

## Workflows

| # | File | Trigger | What It Does |
|---|------|---------|--------------|
| 1 | `lead-capture.json` | Webhook POST `/webhook/booking-inquiry` | Receives website form → validates Origin (`rewindmediaevents.com`) + honeypot + required fields → creates Person in Twenty CRM → adds to Listmonk inquiry list → emails owner |
| 2 | `send-contract.json` | Webhook POST `/webhook/quote-to-contract` | Creates DocuSeal submission → updates Twenty CRM with contract ID |
| 3 | `contract-signed-callback.json` | Webhook POST `/webhook/contract-signed` | DocuSeal posts here on signature → marks contract signed in Twenty → creates Invoice Ninja invoice → emails owner |
| 4 | `add-to-calendar.json` | Webhook POST `/webhook/calendar-sync` | Creates event in **Google Calendar OR Cal.com** (configurable) → saves event ID to Twenty → adds client to Listmonk booking list |
| 5 | `calculate-travel.json` | Webhook POST `/webhook/calculate-travel` | Google Distance Matrix → returns one-way/round-trip miles + duration |
| 6 | `update-gas-price.json` | Schedule (every 3 hours) + Webhook GET `/webhook/gas-price` | Fetches EIA weekly retail gas price → caches in static data → serves via webhook |
| 7 | `daily-summary.json` | Schedule (daily 7 AM) | Queries yesterday's inquiries + invoices → emails digest to owner |
| 8 | `low-stock-alert.json` | Schedule (daily 8 AM) | Queries InvenTree for low-stock parts → emails owner if any found |
| 9 | `deposit-receipt.json` | Webhook POST `/webhook/deposit-receipt` | Marks deposit paid in Twenty CRM → sends receipt email to client → notifies owner |
| 10 | `reorder-prediction.json` | Schedule (weekly, Monday 9 AM) | Analyzes stock levels vs. reorder thresholds → emails categorized prediction report |

---

## Security Features (lead-capture.json)

The lead-capture webhook is the only endpoint exposed to the public internet
(your website form at `rewindmediaevents.com`). It includes three layers of
protection:

1. **Origin Header Validation** — Rejects any POST not from `https://rewindmediaevents.com`
2. **Honeypot Field** — Hidden `website` field must be empty (bots auto-fill it)
3. **Required Field Check** — `firstName`, `lastName`, `email`, `eventDate` must be present

Rejected requests receive proper CORS headers so the browser handles errors gracefully.

---

## Calendar Integration (add-to-calendar.json)

The calendar workflow supports **both** Google Calendar and Cal.com:

- Pass `"calendarProvider": "google"` (default) to use Google Calendar via OAuth2
- Pass `"calendarProvider": "calcom"` to use Cal.com's API

The workflow stores the event ID in Twenty CRM prefixed with the provider name
(e.g., `google:abc123` or `calcom:456`) so you always know which calendar owns it.

---

## Internal Hostnames

All workflow HTTP nodes use **Docker internal hostnames**, not external URLs:

| Service | Internal URL |
|---------|-------------|
| Twenty CRM | `http://twenty:3000/api` |
| Invoice Ninja | `http://ninja-nginx:80/api/v1` |
| DocuSeal | `http://docuseal:3000/api` |
| InvenTree | `http://inventree:8000/api` |
| Listmonk | `http://listmonk:9000/api` |
| Cal.com | `http://calcom:3000/api/v1` |

These only resolve inside the Docker `photobooth-net` network. The dashboard
(running in the browser) uses `localhost:<port>` instead — see `dashboard/js/config.js`.

---

## Environment Variables Referenced

Workflows use `{{$env.VARIABLE}}` to read values from the n8n container's
environment (passed through in `docker-compose.yml`):

- `EIA_API_KEY` / `EIA_STATE_CODE` — gas price lookup
- `GOOGLE_MAPS_API_KEY` — distance calculation
- `DOCUSEAL_TEMPLATE_ID` — contract template
- `LISTMONK_INQUIRY_LIST_ID` / `LISTMONK_BOOKING_LIST_ID` — mailing lists
- `BUSINESS_OWNER_EMAIL` — notification recipient
- `DOMAIN_BASE` — links in emails
- `CALCOM_API_KEY` — Cal.com booking creation (optional)

---

## How to Import

1. Open n8n → **Workflows** → **+ Add Workflow** → **Import from File…**
2. Select one `.json` file from this folder
3. Click each node → verify the **Credential** dropdown is green (not red)
4. Click **Save** → flip **Inactive → Active**
5. Repeat for the remaining 9 files

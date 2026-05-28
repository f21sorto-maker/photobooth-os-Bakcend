# Photo Booth Business OS — Setup Manual

> Complete deployment guide for **Rewind Media Events**
> Self-hosted Docker Compose stack with 9 services on `photobooth-net`

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [First Launch](#3-first-launch)
4. [Twenty CRM Setup](#4-twenty-crm-setup)
5. [Invoice Ninja Setup](#5-invoice-ninja-setup)
6. [DocuSeal Setup](#6-docuseal-setup)
7. [InvenTree Setup](#7-inventree-setup)
8. [Listmonk Setup](#8-listmonk-setup)
9. [Cal.com Setup](#9-calcom-setup)
10. [n8n Workflow Setup](#10-n8n-workflow-setup)
11. [EIA Gas-Price API](#11-eia-gas-price-api)
12. [Dashboard Configuration](#12-dashboard-configuration)
13. [Verification Checklist](#13-verification-checklist)
14. [Troubleshooting](#14-troubleshooting)
15. [Architecture Notes](#15-architecture-notes)

---

## 1. Prerequisites

**Server requirements**: 4+ GB RAM, 20 GB disk, Docker Engine 24+, Docker Compose v2

```bash
# Clone the project
git clone <your-repo-url> photobooth-os
cd photobooth-os

# Copy environment template
cp .env.example .env
```

**DNS / local hosts** — add to `/etc/hosts` (or your DNS):

```
127.0.0.1 dashboard.photobooth.local
127.0.0.1 crm.photobooth.local
127.0.0.1 invoice.photobooth.local
127.0.0.1 contracts.photobooth.local
127.0.0.1 inventory.photobooth.local
127.0.0.1 email.photobooth.local
127.0.0.1 automation.photobooth.local
127.0.0.1 calendar.photobooth.local
```

---

## 2. Environment Configuration

Edit `.env` and generate **unique** secrets for every service:

```bash
# Generate secrets (run each separately — they MUST be different)
openssl rand -hex 32    # → TWENTY_APP_SECRET
openssl rand -base64 32 # → INVOICE_NINJA_APP_KEY (prefix with "base64:")
openssl rand -hex 64    # → DOCUSEAL_SECRET_KEY_BASE
openssl rand -hex 32    # → INVENTREE_SECRET_KEY
openssl rand -hex 32    # → N8N_ENCRYPTION_KEY
openssl rand -hex 32    # → CALCOM_NEXTAUTH_SECRET
openssl rand -hex 32    # → CALCOM_ENCRYPTION_KEY
openssl rand -hex 32    # → POSTGRES_PASSWORD
openssl rand -hex 32    # → REDIS_PASSWORD
openssl rand -hex 16    # → NINJA_DB_ROOT_PASSWORD
openssl rand -hex 16    # → NINJA_DB_PASSWORD
```

> ⚠️ **SECURITY**: Every secret MUST be unique. Never reuse the same value for multiple services.
> ⚠️ **N8N_ENCRYPTION_KEY**: Once n8n starts with this key, it cannot be changed without losing all credentials.

---

## 3. First Launch

```bash
# Start all containers
docker compose up -d

# Initialize databases (idempotent — safe to re-run)
bash scripts/init-databases.sh

# Verify everything is up
bash scripts/healthcheck.sh
```

All 13 `photobooth-*` containers should show `Up` (not `Restarting`):

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep photobooth
```

**Trust Caddy's local CA** (macOS only — eliminates browser SSL warnings):

```bash
docker exec photobooth-caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt
# Double-click caddy-root.crt → Keychain Access → "Always Trust"
```

---

## 4. Twenty CRM Setup

Open `https://crm.photobooth.local` → create admin account.

### Custom Fields

Navigate: **Settings → Data Model → People** → **Add Field** for each:

| Field Name | Type | Options |
|-----------|------|---------|
| `eventDate` | Date | — |
| `eventType` | Select | Birthday, Corporate, Wedding, School, Other |
| `eventAddress` | Text | — |
| `guestCount` | Number | — |
| `inquiryStatus` | Select | Follow Up, Unsure, Denied, Booked |
| `depositPaid` | Boolean | — |
| `depositAmount` | Currency | — |
| `contractSent` | Boolean | — |
| `contractSigned` | Boolean | — |
| `invoiceNinjaClientId` | Text | — |
| `invoiceNinjaQuoteId` | Text | — |
| `docusealContractId` | Text | — |
| `calendarEventId` | Text | — |
| `source` | Select | Website Form, Manual Entry, Referral, Walk-In |
| `travelMiles` | Number | — |
| `estimatedCost` | Currency | — |
| `estimatedRevenue` | Currency | — |
| `estimatedMargin` | Currency | — |
| `notes` | Long Text | — |

Or run the automated script:

```bash
TWENTY_API_KEY=<eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImEyNmUzNGVkLTFiMWEtNGM4Yi1hOTE4LWJjMGFhYzBiMGJhNyJ9.eyJzdWIiOiJlZDQzYjk3NC05MDM1LTQzZTctYmM3Mi1hYzM3ZTY4YTZmNGYiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiZWQ0M2I5NzQtOTAzNS00M2U3LWJjNzItYWMzN2U2OGE2ZjRmIiwiaWF0IjoxNzc5MzQzNTU0LCJleHAiOjQ5MzI5NDM1NTMsImp0aSI6IjZlMjNhZTQ2LWEwYjktNDJmMS1hNzk2LTAwNzY5MjcyYjcwNyJ9.t8aVDqHBu1r4tDGipN427kumP0Ycx0nDQLXcU5FZrNIIpQQZeG_uuVUOiGH9rSpSHHo47qpRv_ET-DCI6bNrPQ> TWENTY_PERSON_OBJECT_ID=<person-id> bash scripts/setup-twenty-fields.sh
```

### API Key

**Settings → API Keys → Create API Key** (name: "Dashboard") → copy → paste into `dashboard/js/config.js` as `TWENTY_API_KEY`

**Verify:**

```bash
curl -sk -X POST https://crm.photobooth.local/api \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { findManyPeople { edges { node { id } } } }"}'
```

---

## 5. Invoice Ninja Setup

Open `https://invoice.photobooth.local` → complete setup wizard.

### Products (Settings → Products)

| Product | Price (cents) | Description |
|---------|---------------|-------------|
| Photo Booth — Standard Package | 59900 | 3-hour booth, unlimited prints, props |
| Photo Booth — Premium Package | 89900 | 4-hour booth, custom backdrop, green screen |
| Photo Booth — Deluxe Package | 129900 | 5-hour booth, all features + social sharing |
| Additional Hour | 15000 | Per hour beyond package |
| Custom Backdrop | 7500 | Themed backdrop design & print |
| Green Screen Experience | 10000 | Digital background replacement |
| Photo Album | 4500 | Physical album |
| USB Drive | 2500 | Digital copies on branded USB |
| Travel Fee | 0 | Override per-event (calculated) |

### Expense Categories (Settings → Expense Categories)

Create: Ink & Paper, Props & Costumes, Vehicle Fuel, Vehicle Maintenance, Equipment Repair, Software Subscriptions, Marketing & Ads, Insurance, Venue Parking, Meals & Per Diem

### API Token

**Settings → Account Management → API Tokens → New Token** → paste into `config.js` as `INVOICE_NINJA_API_TOKEN`

---

## 6. DocuSeal Setup

Open `https://contracts.photobooth.local` → create admin.

1. **Templates → New Template** → upload your contract PDF
2. Add these fields with exact names: `clientName`, `clientEmail`, `eventDate`, `eventType`, `eventAddress`, `serviceHours`, `totalAmount`, `depositAmount`, `contractDate`, + a Signature field
3. Note the **Template ID** from the URL → paste into `.env` as `DOCUSEAL_TEMPLATE_ID` and `config.js`
4. **Settings → API** → generate token → paste into `config.js` as `DOCUSEAL_API_TOKEN`
5. **Settings → Webhooks** → URL: `https://automation.photobooth.local/webhook/contract-signed`, Event: `submission.completed`

---

## 7. InvenTree Setup

Open `https://inventory.photobooth.local` → login with `.env` credentials.

1. **Parts → Categories → New Category**: `Photo Booth Supplies`
2. Add 8 parts (see `docs/MANUAL-SETUP.md` Section D for full list)
3. **Settings → API Tokens** → generate → paste into `config.js` as `INVENTREE_API_TOKEN`

---

## 8. Listmonk Setup

Open `https://email.photobooth.local` → login with `.env` credentials.

1. **Lists → New**: `Website Inquiries` (note integer ID → `.env` `LISTMONK_INQUIRY_LIST_ID`)
2. **Lists → New**: `Booked Clients` (note integer ID → `.env` `LISTMONK_BOOKING_LIST_ID`)
3. **Settings → SMTP**: Configure Brevo (or your SMTP provider)
4. Send a **test email** to verify delivery

> Listmonk uses **integer** list IDs (1, 2, 3…), not UUIDs.

---

## 9. Cal.com Setup

> **Optional** — you can use Google Calendar (via n8n) instead. Both are supported.

Open `https://calendar.photobooth.local` → create admin.

1. **Settings → Developer → API Keys** → generate → paste into `config.js` as `CALCOM_API_KEY`
2. **Settings → Calendars** → connect Google Calendar (uses the same Google Cloud project)
3. **Event Types → New** → create your booking event type, note the ID
4. In `config.js`, set `CALENDAR_PROVIDER: 'calcom'` to switch from Google Calendar

To keep using Google Calendar (default), leave `CALENDAR_PROVIDER: 'google'`.

---

## 10. n8n Workflow Setup

Open `https://automation.photobooth.local` → login with `.env` credentials.

### Create Credentials (Settings → Credentials)

| Name | Type | Key Header / Notes |
|------|------|-------------------|
| Twenty API | HTTP Header Auth | `Authorization: Bearer <key>` |
| Invoice Ninja | HTTP Header Auth | `X-Api-Token: <token>` |
| DocuSeal | HTTP Header Auth | `X-Auth-Token: <token>` |
| InvenTree | HTTP Header Auth | `Authorization: Token <token>` |
| Listmonk | Basic Auth | `admin:<password>` |
| SMTP | SMTP | Brevo: `smtp-relay.brevo.com:587` |
| Google Calendar OAuth2 | Google OAuth2 | Requires Google Cloud Console project |

### Import Workflows

Import each file from `n8n-workflows/` (see `n8n-workflows/README.md` for details):

1. `lead-capture.json` — website form → CRM + email
2. `send-contract.json` — quote → DocuSeal contract
3. `contract-signed-callback.json` — DocuSeal → invoice + CRM update
4. `add-to-calendar.json` — Google Calendar OR Cal.com
5. `calculate-travel.json` — Google Distance Matrix
6. `update-gas-price.json` — EIA weekly gas price cache
7. `daily-summary.json` — 7 AM digest email
8. `low-stock-alert.json` — 8 AM inventory check
9. `deposit-receipt.json` — deposit confirmation email
10. `reorder-prediction.json` — weekly supply forecast

For each: import → verify credentials → save → activate.

---

## 11. EIA Gas-Price API

1. Register free at: https://www.eia.gov/opendata/register.php
2. Add to `.env`: `EIA_API_KEY=<your-key>` and `EIA_STATE_CODE=SOH` (Ohio)
3. Restart n8n: `docker compose up -d --force-recreate n8n`
4. Verify: `bash scripts/fetch-gas-price.sh`
5. Import and activate `update-gas-price.json` in n8n
6. Test: `curl -s https://automation.photobooth.local/webhook/gas-price | jq`

---

## 12. Dashboard Configuration

Edit `dashboard/js/config.js` and replace every `YOUR_*` placeholder:

- `TWENTY_API_KEY` — from Section 4
- `INVOICE_NINJA_API_TOKEN` — from Section 5
- `DOCUSEAL_API_TOKEN` + `DOCUSEAL_TEMPLATE_ID` — from Section 6
- `INVENTREE_API_TOKEN` — from Section 7
- `LISTMONK_PASSWORD` — from `.env`
- `CALCOM_API_KEY` — from Section 9 (if using Cal.com)
- `CALENDAR_PROVIDER` — `'google'` or `'calcom'`

The dashboard is a **modular JavaScript application** served as static files by Caddy.
All API calls use `localhost:<port>` because the browser runs outside Docker.

Access at: `https://dashboard.photobooth.local`

---

## 13. Verification Checklist

- [ ] All 13 containers running (`docker ps | grep photobooth`)
- [ ] `healthcheck.sh` passes all checks
- [ ] 19 custom fields visible in Twenty CRM → People
- [ ] Twenty API key tested with curl
- [ ] 9 Invoice Ninja products created
- [ ] 10 expense categories created
- [ ] DocuSeal template uploaded with all fields
- [ ] DocuSeal webhook pointed to n8n
- [ ] 8 InvenTree parts with stock levels
- [ ] Listmonk test email delivered
- [ ] Listmonk list IDs recorded as integers
- [ ] Cal.com booking page accessible (if using Cal.com)
- [ ] 10 n8n workflows imported, credentials green, active
- [ ] EIA gas price returning data
- [ ] Google Maps API key set and restricted
- [ ] No `YOUR_` placeholders remaining in `config.js`
- [ ] Dashboard loads at `https://dashboard.photobooth.local`
- [ ] Lead-capture webhook rejects non-rewindmediaevents.com origins

---

## 14. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Twenty "Database error" | `twenty_db` not created | `bash scripts/init-databases.sh` |
| Invoice Ninja 500 | `APP_KEY` wrong format | Must be base64: `openssl rand -base64 32` |
| DocuSeal won't start | `SECRET_KEY_BASE` too short | Must be 64 hex chars |
| Listmonk 502 | Schema not installed | `docker compose run --rm listmonk ./listmonk --install --idempotent --yes` |
| InvenTree 502 | Migrations needed | `docker compose run --rm inventree invoke update` |
| n8n "Encryption key error" | Key changed after first run | Never change this key after first start |
| Cal.com "NEXTAUTH error" | Missing `CALCOM_NEXTAUTH_SECRET` | Generate with `openssl rand -hex 32` |
| Caddy blank page | `DOMAIN_BASE` mismatch | Check `.env` matches `/etc/hosts` |
| Browser "Not secure" | Local CA not trusted | Trust Caddy root cert (see Section 3) |
| Container restarting | Check logs | `docker logs --tail 50 photobooth-<name>` |
| Lead webhook accepts spam | Origin check failing | Verify `lead-capture.json` is active in n8n |

---

## 15. Architecture Notes

### Dashboard: Modular JavaScript

The dashboard uses a **modular ES module architecture** — NOT a single monolithic HTML file.
This was a deliberate design choice for maintainability:

```
dashboard/
├── photobooth-admin.html    ← Entry point (loaded by Caddy)
├── css/style.css             ← Design system
└── js/
    ├── app.js                ← Shell (sidebar, modal, toast)
    ├── router.js             ← Hash-based SPA router
    ├── config.js             ← All API keys and URLs
    ├── api.js                ← Every external API call
    ├── utils.js              ← Formatting helpers
    ├── services/
    │   └── travel-cost.js    ← Travel cost calculator
    └── views/
        ├── overview.js       ← Dashboard home
        ├── inquiries.js      ← Lead management table
        ├── clients.js        ← Client directory
        ├── client-detail.js  ← Single client view
        ├── quote-builder.js  ← Quote creation with travel calc
        ├── accounting.js     ← Expenses and P&L
        ├── inventory.js      ← InvenTree stock view
        └── settings.js       ← Connection tests and config
```

### Network: Docker Internal vs. Browser

| Context | URL Pattern | Example |
|---------|-------------|---------|
| n8n workflows (inside Docker) | Docker hostname | `http://twenty:3000/api` |
| Dashboard (browser, outside Docker) | localhost:port | `http://localhost:20000/api` |
| Public website form | Caddy subdomain | `https://automation.photobooth.local/webhook/booking-inquiry` |

### Calendar: Dual Provider Support

The system supports **both** Google Calendar and Cal.com simultaneously:

- `config.js → CALENDAR_PROVIDER: 'google'` — n8n creates Google Calendar events via OAuth2
- `config.js → CALENDAR_PROVIDER: 'calcom'` — n8n creates Cal.com bookings via REST API

Cal.com also provides a **public booking page** (`https://calendar.photobooth.local`)
that clients can use to self-book, which is not available with Google Calendar alone.

### Reverse Proxy: Caddy Only

Caddy handles all routing, SSL certificates (auto-provisioned via internal CA for local
dev, Let's Encrypt for production), and CORS enforcement. No nginx required.

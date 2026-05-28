# Photo Booth OS — Manual Setup Guide

Complete this guide **before** opening the dashboard or importing n8n workflows.
Estimated time: 90–120 minutes.

---

## Prerequisites

```bash
cd photobooth-os
cp .env.example .env
# Edit .env and fill ALL values (especially generate secrets with openssl rand -hex 32)
docker compose up -d
bash scripts/init-databases.sh
bash scripts/healthcheck.sh
```

All services should show ✅ before proceeding.

---

## SECTION A — Twenty CRM Custom Fields

Open https://crm.photobooth.local → Sign up with your admin email.

Navigate: **Settings → Data Model → People**

For each field below, click **Add Field** and configure exactly:

| # | Field Name | Type | Options / Notes |
|---|-----------|------|-----------------|
| 1 | `eventDate` | Date | — |
| 2 | `eventType` | Select | Birthday, Corporate, Wedding, School, Other |
| 3 | `eventAddress` | Text | — |
| 4 | `guestCount` | Number | — |
| 5 | `inquiryStatus` | Select | Follow Up, Unsure, Denied, Booked |
| 6 | `depositPaid` | Boolean | — |
| 7 | `depositAmount` | Currency | — |
| 8 | `contractSent` | Boolean | — |
| 9 | `contractSigned` | Boolean | — |
| 10 | `invoiceNinjaClientId` | Text | — |
| 11 | `invoiceNinjaQuoteId` | Text | — |
| 12 | `docusealContractId` | Text | — |
| 13 | `calendarEventId` | Text | — |
| 14 | `source` | Select | Website Form, Manual Entry, Referral, Walk-In |
| 15 | `travelMiles` | Number | — |
| 16 | `estimatedCost` | Currency | — |
| 17 | `estimatedRevenue` | Currency | — |
| 18 | `estimatedMargin` | Currency | — |
| 19 | `notes` | Long Text | — |

After all 19 fields are added:
1. Go to **Settings → API Keys**
2. Click **Create API Key**, name it "Dashboard"
3. Copy the key → paste into `dashboard/js/config.js` as `TWENTY_API_KEY`

**Verification:**
```bash
curl -X POST https://crm.photobooth.local/graphql \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { findManyPeople { edges { node { id } } } }"}'
```
Should return JSON with `data.findManyPeople.edges` array (possibly empty).

---

## SECTION B — Invoice Ninja Setup

Open https://invoice.photobooth.local → Follow the setup wizard.

### Products to Create
Navigate: **Settings → Products**

Create these 9 products (all with tax enabled):

| Product Name | Price | Description |
|-------------|-------|-------------|
| Photo Booth — Standard Package | 59900 | 3-hour booth, unlimited prints, props |
| Photo Booth — Premium Package | 89900 | 4-hour booth, custom backdrop, green screen |
| Photo Booth — Deluxe Package | 129900 | 5-hour booth, all premium features + social sharing |
| Additional Hour | 15000 | Per hour beyond package |
| Custom Backdrop | 7500 | Themed backdrop design & print |
| Green Screen Experience | 10000 | Digital background replacement |
| Photo Album | 4500 | Physical album with event photos |
| USB Drive | 2500 | Digital copies on branded USB |
| Travel Fee | 0 | Calculated per event (override in quote) |

### Expense Categories
Navigate: **Settings → Expense Categories**

Create these 10 categories:
1. Ink & Paper
2. Props & Costumes
3. Vehicle Fuel
4. Vehicle Maintenance
5. Equipment Repair
6. Software Subscriptions
7. Marketing & Ads
8. Insurance
9. Venue Parking
10. Meals & Per Diem

### Tax Rate
Navigate: **Settings → Tax Rates**
- Add your state's sales tax rate (e.g., OH = 5.75%)

### API Token
Navigate: **Settings → Account Management → API Tokens**
- Click **New Token**, name it "Dashboard"
- Copy token → paste into `dashboard/js/config.js` as `INVOICE_NINJA_API_TOKEN`

### Company Settings
Navigate: **Settings → Company Details**
- Upload your business logo
- Fill business name, address, phone, email

---

## SECTION C — DocuSeal Setup

Open https://contracts.photobooth.local → Create admin account.

### Upload Contract Template
1. Navigate: **Templates → New Template**
2. Upload your contract PDF (you must supply your own contract document)
3. Use the field placement tool to add these fields with EXACT names:

| Field Name | Type | Role |
|-----------|------|------|
| `clientName` | Text | Client |
| `clientEmail` | Text | Client |
| `eventDate` | Date | Client |
| `eventType` | Text | Client |
| `eventAddress` | Text | Client |
| `serviceHours` | Number | Client |
| `totalAmount` | Number | Client |
| `depositAmount` | Number | Client |
| `contractDate` | Date | Client |
| *(no name needed)* | Signature | Client |

4. Save template. Note the Template ID from the URL (e.g., `/templates/42` → ID is `42`)
5. Paste into `dashboard/js/config.js` as `DOCUSEAL_TEMPLATE_ID`

### API Token
Navigate: **Settings → API**
- Generate token → paste into `dashboard/js/config.js` as `DOCUSEAL_API_TOKEN`

### Webhook
Navigate: **Settings → Webhooks**
- URL: `https://automation.photobooth.local/webhook/contract-signed`
- Event: `submission.completed`
- Copy the webhook secret → paste into `.env` as `DOCUSEAL_WEBHOOK_SECRET`

---

## SECTION D — InvenTree Setup

Open https://inventory.photobooth.local → Login with credentials from `.env`.

### Create Category
Navigate: **Parts → Categories → New Category**
- Name: `Photo Booth Supplies`

### Add Parts
Navigate: **Parts → New Part** for each:

| Part Name | Category | Initial Stock | Reorder Level | Unit Cost |
|-----------|----------|---------------|---------------|-----------|
| Dye-Sub Ink Set | Photo Booth Supplies | 5 | 2 | 4500 |
| Photo Paper Pack (4x6) | Photo Booth Supplies | 20 | 5 | 1200 |
| Photo Paper Pack (6x8) | Photo Booth Supplies | 10 | 3 | 1800 |
| Props Set — Birthday | Photo Booth Supplies | 3 | 1 | 3500 |
| Props Set — Wedding | Photo Booth Supplies | 3 | 1 | 3500 |
| Props Set — Corporate | Photo Booth Supplies | 3 | 1 | 3500 |
| Custom Backdrop Material | Photo Booth Supplies | 5 | 2 | 2500 |
| USB Drive (branded) | Photo Booth Supplies | 15 | 5 | 800 |

### Add Suppliers
Navigate: **Buy → Suppliers → New Supplier**
- Add your usual suppliers for ink, paper, props

### API Token
Navigate: **Settings → API Tokens**
- Create token → paste into `dashboard/js/config.js` as `INVENTREE_API_TOKEN`

---

## SECTION E — Listmonk Setup

Open https://email.photobooth.local → Follow setup wizard.

### Create Lists
Navigate: **Lists → New**
1. Name: `Website Inquiries` → save, note the ID
2. Name: `Booked Clients` → save, note the ID
3. Name: `Past Event Attendees` → save, note the ID

Paste the IDs into `dashboard/js/config.js`:
- `LISTMONK_INQUIRY_LIST_ID`
- `LISTMONK_BOOKING_LIST_ID`

### SMTP Configuration
Navigate: **Settings → Settings → SMTP**
- Host: `smtp-relay.brevo.com`
- Port: `587`
- Username: your Brevo SMTP user
- Password: your Brevo SMTP password
- From email: your business email
- Click **Send Test** → verify you receive it

### Admin Credentials
The login for Listmonk uses the credentials from `.env` (`LISTMONK_ADMIN_USER` / `LISTMONK_ADMIN_PASSWORD`).

---

## SECTION F — n8n Setup

Open https://automation.photobooth.local → Login with basic auth from `.env`.

### Credentials
Navigate: **Settings → Credentials**

Add each of these:

1. **Google Calendar OAuth2**
   - Follow the OAuth setup flow (requires Google Cloud Console project)
   - Scopes: `https://www.googleapis.com/auth/calendar`

2. **SMTP**
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - User: your Brevo SMTP user
   - Password: your Brevo SMTP password

3. **Generic HTTP Header Auth — Twenty CRM**
   - Name: `Twenty API`
   - Header: `Authorization`
   - Value: `Bearer YOUR_TWENTY_API_KEY`

4. **Generic HTTP Header Auth — Invoice Ninja**
   - Name: `Invoice Ninja`
   - Header: `X-Api-Token`
   - Value: `YOUR_NINJA_API_TOKEN`

5. **Generic HTTP Header Auth — DocuSeal**
   - Name: `DocuSeal`
   - Header: `X-Auth-Token`
   - Value: `YOUR_DOCUSEAL_API_TOKEN`

6. **Generic HTTP Header Auth — InvenTree**
   - Name: `InvenTree`
   - Header: `Authorization`
   - Value: `Token YOUR_INVENTREE_API_TOKEN`

7. **Basic Auth — Listmonk**
   - Name: `Listmonk`
   - Username: `admin`
   - Password: `YOUR_LISTMONK_PASSWORD`

### Import Workflows

The 7 workflow JSON files live in `photobooth-os/n8n-workflows/`. **Do credentials first (above), then import** — workflows reference credentials by name, so importing first leaves broken nodes.

n8n imports **one file at a time**. For each of the 7 files:

1. In the n8n left sidebar click **Workflows**.
2. Click **+ Add workflow** ▾ (top right) → **Import from File…** (older versions: the **⋯** menu on the Workflows page → **Import from file**).
3. Pick one `.json` file from `photobooth-os/n8n-workflows/`. The workflow editor opens.
4. Click each node and confirm the **Credential** dropdown shows the matching credential you created (Twenty API / Invoice Ninja / DocuSeal / InvenTree / Listmonk / SMTP / Google Calendar). A red **!** badge means the credential isn't selected — pick it from the dropdown.
5. Click **Save** (top right), then flip the **Inactive → Active** toggle (top right).
6. Repeat for the other 6 files.

The 7 files and what they do:

| File | Trigger |
|------|---------|
| `booking-inquiry.json` | Webhook `/webhook/booking-inquiry` — website form → Twenty + Listmonk + email |
| `contract-signed-callback.json` | Webhook `/webhook/contract-signed` — DocuSeal posts here on signature |
| `calculate-travel.json` | Webhook `/webhook/calculate-travel` — called by the dashboard for travel quotes |
| `quote-to-contract.json` | Webhook `/webhook/quote-to-contract` — sends contract for signature |
| `low-stock-alert.json` | Schedule, daily 8 AM — emails you parts below reorder level |
| `daily-summary.json` | Schedule, daily 7 AM — yesterday's revenue/inquiry digest |
| `calendar-sync.json` | Webhook `/webhook/calendar-sync` — creates Google Calendar event for a booking |

**For the DocuSeal webhook workflow specifically** (`contract-signed-callback.json`):
1. Open the workflow and click the **Webhook (DocuSeal)** node.
2. Copy the **Production URL** (it will be `https://automation.photobooth.local/webhook/contract-signed`).
3. Paste that exact URL into **DocuSeal → Settings → Webhooks** (Section C step 3).

> See [`n8n-workflows/README.md`](../n8n-workflows/README.md) for screenshots-free step-by-step import instructions.


---

## SECTION G — Google Maps API

1. Go to https://console.cloud.google.com
2. Create a new project named "Photo Booth OS"
3. Enable the **Distance Matrix API**
4. Create an API key
5. Restrict the key to **Distance Matrix API only**
6. Go to **Quotas** → set cap to **40,000 requests/month**
7. Paste the key into `.env` as `GOOGLE_MAPS_API_KEY`

---

## SECTION G2 — EIA Gas-Price API (Live Travel-Cost Pricing)

Travel cost on every invoice is calculated from **live, regional** gas prices so you bill an honest fuel cost no matter what's happening at the pump. The data source is the U.S. **Energy Information Administration (EIA)** — the official government series that AAA, GasBuddy and the news media derive their numbers from. It's free, no credit card, no usage cap that matters here.

**Vehicle on file** — the dashboard assumes a **2024 Subaru Forester Wilderness**:
- 25 MPG combined (EPA — city 25 / hwy 28)
- Takes **regular 87-octane unleaded** (not premium)
- Wear-and-tear: **$0.60/mile** (depreciation + tires + oil + brakes)

To change vehicle later, edit `dashboard/js/config.js → CONFIG.VEHICLE` and `.env → VEHICLE_MPG`.

### Steps

1. Open https://www.eia.gov/opendata/register.php
2. Enter your name + email → click **Register**. The key is emailed to you in under a minute (no signup confirmation hoops).
3. Paste it into `.env`:
   ```
   EIA_API_KEY=your_key_from_email
   EIA_STATE_CODE=SOH        # SOH = Ohio. SCA, SFL, SNY, STX, SPADD2 (Midwest), etc.
   ```
4. Restart n8n so the new env vars are visible inside the workflow:
   ```bash
   docker compose up -d --force-recreate n8n
   ```
5. Verify the EIA key works from the command line:
   ```bash
   bash scripts/fetch-gas-price.sh
   ```
   You should see something like:
   ```
   ✅ Latest retail gas price
      Area:    OHIO
      Product: Regular Gasoline
      Week of: 2026-05-12
      Price:   $3.142 / gallon
   ```
6. In n8n, import **`n8n-workflows/update-gas-price.json`**, save, and toggle **Active**.
   This workflow:
   - Runs every 3 hours, fetches the latest weekly Ohio retail regular-gasoline price from EIA, and caches it.
   - Exposes `GET https://automation.photobooth.local/webhook/gas-price` so the dashboard can read it.
7. Test the webhook end-to-end:
   ```bash
   curl -s https://automation.photobooth.local/webhook/gas-price | jq
   ```
   Expected:
   ```json
   {
     "gasPricePerGallon": 3.142,
     "period": "2026-05-12",
     "area": "OHIO",
     "product": "Regular Gasoline",
     "source": "EIA-878 Weekly Retail Gasoline Prices",
     "ageHours": 0.01
   }
   ```

The travel-cost service (`dashboard/js/services/travel-cost.js`) calls this endpoint, caches the answer in `localStorage` for 3 hours, falls back to `CONFIG.GAS_PRICE_PER_GALLON_FALLBACK` if the n8n workflow is offline, and produces a per-invoice line item that looks like:

```
Travel: Dayton, OH 45402 → 123 Main St, Cincinnati OH
Round trip: 110 mi @ 25 mpg (2024 Subaru Forester Wilderness)
Fuel: 4.40 gal × $3.142/gal = $13.82 (OHIO, 2026-05-12)
Wear & tear: 110 mi × $0.60 = $66.00
                                  Total travel fee:   $79.82
```

---


## SECTION H — Verification Checklist

Tick every box before proceeding to Phase 4:

- [ ] All 19 Twenty CRM fields created and visible in a Person record
- [ ] Twenty API key tested with the curl example in Section A
- [ ] All 9 Invoice Ninja products created
- [ ] All 10 expense categories created
- [ ] Tax rate added
- [ ] DocuSeal template uploaded with all 9 fields + 1 signature
- [ ] DocuSeal Template ID recorded in `config.js`
- [ ] DocuSeal webhook secret pasted into `.env`
- [ ] All 8 InvenTree parts created with stock levels and prices
- [ ] Listmonk SMTP test email received
- [ ] Listmonk list IDs recorded in `config.js`
- [ ] n8n Google Calendar OAuth connected (test event created successfully)
- [ ] n8n SMTP credential added
- [ ] Google Maps API key restricted and quota capped
- [ ] All placeholder values in `dashboard/js/config.js` replaced (no "YOUR_" remaining)

---

## Troubleshooting This Setup

| Problem | Cause | Fix |
|---------|-------|-----|
| Twenty CRM shows "Database error" | twenty_db not created | Run `bash scripts/init-databases.sh` |
| Invoice Ninja 500 on first load | APP_KEY wrong format | Must be base64, 32 bytes: `openssl rand -base64 32` |
| DocuSeal won't start | SECRET_KEY_BASE too short | Must be 64 hex chars: `openssl rand -hex 64` |
| Listmonk setup wizard loops | listmonk_db not created | Run init-databases.sh, restart listmonk container |
| **`email.photobooth.local` → 502 Bad Gateway** | Listmonk schema never installed (DB exists but is empty). Logs show `the database does not appear to be setup. Run --install.` | `docker compose run --rm listmonk ./listmonk --install --idempotent --yes` then `docker compose up -d listmonk` |
| **`inventory.photobooth.local` → 502 Bad Gateway** | InvenTree is restarting because (a) `INVENTREE_SITE_URL` / `INVENTREE_TRUSTED_ORIGINS` aren't set (CSRF error), or (b) DB migrations haven't run (`INVE-W8: Database Migrations required`) | (a) is already fixed in `docker-compose.yml`. For (b) run `docker compose run --rm inventree invoke update` (takes 2–5 min), then `docker compose restart inventree` |
| n8n shows "Encryption key error" | N8N_ENCRYPTION_KEY changed after first run | Never change this key. If you did, delete n8n_data volume and re-import |
| Caddy shows blank page | `.env` DOMAIN_BASE not matching | Ensure `DOMAIN_BASE=photobooth.local` and your `/etc/hosts` has `127.0.0.1 dashboard.photobooth.local` etc. |
| Any subdomain → "This site can't be reached" | `/etc/hosts` missing entries | Add `127.0.0.1 dashboard.photobooth.local crm.photobooth.local invoice.photobooth.local contracts.photobooth.local inventory.photobooth.local email.photobooth.local automation.photobooth.local` |
| Browser warns "Not secure" / certificate untrusted | Caddy is using its internal CA for `.local` domains | Trust Caddy's root CA: copy it from the container with `docker exec photobooth-caddy cat /data/caddy/pki/authorities/local/root.crt > caddy-root.crt`, then add `caddy-root.crt` to **macOS Keychain → System → Certificates** and mark it "Always Trust" |

### Quick "is everything up?" check

```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep photobooth
```
All 12 photobooth-* containers should be `Up` (not `Restarting`). If any are restarting:
```bash
docker logs --tail 50 photobooth-<servicename>
```
…will show the actual error.


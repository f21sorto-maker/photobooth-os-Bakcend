#!/usr/bin/env bash
# =============================================================================
# setup-twenty-fields.sh — Bulk-create all 19 custom fields in Twenty CRM
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# ─── Source .env for DOMAIN_BASE ──────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi

# ─── CONFIGURATION ────────────────────────────────────────────────────────────
# Set these via environment variables or edit here.
# NEVER hardcode real API keys in this file — they get committed to git.
TWENTY_KEY="${TWENTY_API_KEY:-YOUR_TWENTY_API_KEY_HERE}"
PERSON_OBJECT_ID="${TWENTY_PERSON_OBJECT_ID:-PASTE_PERSON_ID_FROM_STEP_2}"
TWENTY_URL="https://crm.${DOMAIN_BASE:-photobooth.local}/metadata"
# ──────────────────────────────────────────────────────────────────────────────

if [[ "$TWENTY_KEY" == "YOUR_TWENTY_API_KEY_HERE" ]] || [[ "$PERSON_OBJECT_ID" == "PASTE_PERSON_ID_FROM_STEP_2" ]]; then
  echo "❌ Set TWENTY_API_KEY and TWENTY_PERSON_OBJECT_ID before running."
  echo ""
  echo "   Option A — environment variables:"
  echo "     TWENTY_API_KEY=eyJ... TWENTY_PERSON_OBJECT_ID=abc-123 bash scripts/setup-twenty-fields.sh"
  echo ""
  echo "   Option B — add to .env:"
  echo "     TWENTY_API_KEY=eyJ..."
  echo "     TWENTY_PERSON_OBJECT_ID=abc-123"
  exit 1
fi

PASSED=0
FAILED=0
SKIPPED=0

create_field() {
  local name="$1"
  local label="$2"
  local description="$3"
  local type="$4"
  local extra_options="$5"  # raw JSON snippet for select options or empty

  local default_value_json="null"
  case "$type" in
    BOOLEAN) default_value_json='false' ;;
    NUMBER|CURRENCY) default_value_json='0' ;;
    TEXT) default_value_json='""' ;;
  esac

  # Build the input JSON
  local payload
  payload=$(cat <<EOF
{
  "query": "mutation CreateField(\$input: CreateOneFieldMetadataInput!) { createOneField(input: \$input) { id name label type } }",
  "variables": {
    "input": {
      "field": {
        "name": "$name",
        "label": "$label",
        "description": "$description",
        "type": "$type",
        "objectMetadataId": "$PERSON_OBJECT_ID",
        "isNullable": true
        $extra_options
      }
    }
  }
}
EOF
)

  local response
  response=$(curl -sk -X POST "$TWENTY_URL" \
    -H "Authorization: Bearer $TWENTY_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if echo "$response" | grep -q '"errors"'; then
    if echo "$response" | grep -qi "already exists\|duplicate"; then
      echo "   ⏭️  $name — already exists (skipping)"
      ((SKIPPED++))
    else
      echo "   ❌ $name — FAILED"
      echo "      Response: $response" | head -c 200
      echo ""
      ((FAILED++))
    fi
  else
    echo "   ✅ $name ($type)"
    ((PASSED++))
  fi
}

echo "═══════════════════════════════════════════════"
echo " TWENTY CRM — BULK FIELD CREATOR"
echo "═══════════════════════════════════════════════"
echo " Target: $TWENTY_URL"
echo " Object: $PERSON_OBJECT_ID"
echo ""
echo "📋 Creating 19 custom fields on Person..."
echo ""

# ─── SIMPLE TYPES ─────────────────────────────────────────────────────────────
create_field "eventDate"             "Event Date"             "Scheduled event date"                "DATE_TIME" ""
create_field "eventAddress"          "Event Address"          "Venue address for travel calc"       "TEXT" ""
create_field "guestCount"            "Guest Count"            "Estimated attendance"                "NUMBER" ""
create_field "depositPaid"           "Deposit Paid"           "Has deposit been received"           "BOOLEAN" ""
create_field "depositAmount"         "Deposit Amount"         "Deposit dollar amount"               "CURRENCY" ""
create_field "contractSent"          "Contract Sent"          "Has contract been sent"              "BOOLEAN" ""
create_field "contractSigned"        "Contract Signed"        "Has client signed contract"          "BOOLEAN" ""
create_field "invoiceNinjaClientId"  "Invoice Ninja Client ID" "Linked Invoice Ninja client"        "TEXT" ""
create_field "invoiceNinjaQuoteId"   "Invoice Ninja Quote ID" "Linked draft quote"                  "TEXT" ""
create_field "docusealContractId"    "DocuSeal Contract ID"   "Linked DocuSeal submission"          "TEXT" ""
create_field "calendarEventId"       "Calendar Event ID"      "Google Calendar event reference"     "TEXT" ""
create_field "travelMiles"           "Travel Miles"           "Round-trip miles"                    "NUMBER" ""
create_field "estimatedCost"         "Estimated Cost"         "Internal cost for this event"        "CURRENCY" ""
create_field "estimatedRevenue"      "Estimated Revenue"      "Quoted to client"                    "CURRENCY" ""
create_field "estimatedMargin"       "Estimated Margin"       "Revenue minus cost"                  "CURRENCY" ""
create_field "notes"                 "Notes"                  "Internal freeform notes"             "TEXT" ""

# ─── SELECT TYPES (need options array) ────────────────────────────────────────
EVENT_TYPE_OPTS=', "options": [
  {"label":"Birthday","value":"BIRTHDAY","position":0,"color":"pink"},
  {"label":"Corporate","value":"CORPORATE","position":1,"color":"blue"},
  {"label":"Wedding","value":"WEDDING","position":2,"color":"purple"},
  {"label":"School","value":"SCHOOL","position":3,"color":"green"},
  {"label":"Other","value":"OTHER","position":4,"color":"gray"}
]'
create_field "eventType" "Event Type" "Type of event" "SELECT" "$EVENT_TYPE_OPTS"

STATUS_OPTS=', "options": [
  {"label":"Follow Up","value":"FOLLOW_UP","position":0,"color":"orange"},
  {"label":"Unsure","value":"UNSURE","position":1,"color":"gray"},
  {"label":"Denied","value":"DENIED","position":2,"color":"red"},
  {"label":"Booked","value":"BOOKED","position":3,"color":"green"}
], "defaultValue": "'\''FOLLOW_UP'\''"'
create_field "inquiryStatus" "Inquiry Status" "Current pipeline stage" "SELECT" "$STATUS_OPTS"

SOURCE_OPTS=', "options": [
  {"label":"Website Form","value":"WEBSITE_FORM","position":0,"color":"blue"},
  {"label":"Manual Entry","value":"MANUAL_ENTRY","position":1,"color":"gray"},
  {"label":"Referral","value":"REFERRAL","position":2,"color":"green"},
  {"label":"Walk-In","value":"WALK_IN","position":3,"color":"orange"}
]'
create_field "source" "Source" "Where this lead came from" "SELECT" "$SOURCE_OPTS"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ Created:  $PASSED"
echo "  ⏭️  Skipped:  $SKIPPED"
echo "  ❌ Failed:   $FAILED"
echo "═══════════════════════════════════════════════"

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "💡 Common failure causes:"
  echo "   • Wrong PERSON_OBJECT_ID → re-run Step 2 query"
  echo "   • API key lacks metadata permissions → regenerate with full access"
  echo "   • Twenty version mismatch → some types might be MULTI_SELECT vs SELECT"
fi

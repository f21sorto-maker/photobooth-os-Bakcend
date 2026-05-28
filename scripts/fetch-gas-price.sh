#!/usr/bin/env bash
# =============================================================================
# fetch-gas-price.sh — Test the EIA gasoline-price feed from the command line.
# =============================================================================
# Usage:    bash scripts/fetch-gas-price.sh
# Requires: EIA_API_KEY (and optionally EIA_STATE_CODE) set in .env
#
# Series used: EIA-878 Weekly Retail Gasoline and Diesel Prices
#   product = EPMR  (Regular Gasoline)
#   process = PTE   (Retail Sales by All Sellers)
#   duoarea = state-level code, e.g. SOH=Ohio, SCA=California, SFL=Florida,
#                                    SNY=New York, STX=Texas, SPADD2=Midwest region
# Get a free API key in ~30 seconds at: https://www.eia.gov/opendata/register.php
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ .env not found at $ENV_FILE"
    exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

if [[ -z "${EIA_API_KEY:-}" || "$EIA_API_KEY" == "YOUR_EIA_API_KEY" ]]; then
    echo "❌ EIA_API_KEY is not set in .env"
    echo "   Sign up free at: https://www.eia.gov/opendata/register.php"
    echo "   Then add to .env:   EIA_API_KEY=your_key_here"
    exit 1
fi

STATE_CODE="${EIA_STATE_CODE:-SOH}"   # Ohio default for Rewind Media Events

echo "🛢️  Fetching latest regular-gasoline retail price for ${STATE_CODE}..."

RESPONSE=$(curl -sS \
    --get "https://api.eia.gov/v2/petroleum/pri/gnd/data/" \
    --data-urlencode "api_key=${EIA_API_KEY}" \
    --data-urlencode "frequency=weekly" \
    --data-urlencode "data[0]=value" \
    --data-urlencode "facets[duoarea][]=${STATE_CODE}" \
    --data-urlencode "facets[product][]=EPMR" \
    --data-urlencode "facets[process][]=PTE" \
    --data-urlencode "sort[0][column]=period" \
    --data-urlencode "sort[0][direction]=desc" \
    --data-urlencode "offset=0" \
    --data-urlencode "length=1")

if ! echo "$RESPONSE" | jq -e '.response.data[0]' > /dev/null 2>&1; then
    echo "❌ Unexpected response from EIA:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

PRICE=$(echo  "$RESPONSE" | jq -r '.response.data[0].value')
PERIOD=$(echo "$RESPONSE" | jq -r '.response.data[0].period')
AREA=$(echo   "$RESPONSE" | jq -r '.response.data[0]["area-name"]')
PRODUCT=$(echo "$RESPONSE" | jq -r '.response.data[0]["product-name"]')

echo ""
echo "✅ Latest retail gas price"
echo "   Area:    $AREA"
echo "   Product: $PRODUCT"
echo "   Week of: $PERIOD"
echo "   Price:   \$$PRICE / gallon"
echo ""
echo "Source: EIA-878 Weekly Retail Gasoline Prices (https://www.eia.gov/dnav/pet/pet_pri_gnd_dcus_${STATE_CODE,,}_w.htm)"

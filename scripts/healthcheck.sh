#!/usr/bin/env bash
# =============================================================================
# healthcheck.sh — Service health status for Photo Booth OS
# =============================================================================
# Prints ✅/❌ for each service and a summary at the end.
# =============================================================================

set -uo pipefail

# Source .env for domain base
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

DOMAIN_BASE="photobooth.local"
if [[ -f "$ENV_FILE" ]]; then
    # shellcheck source=/dev/null
    source "$ENV_FILE"
fi

PASS=0
FAIL=0

check() {
    local name="$1"
    local url="$2"
    local expect="$3"

    # --insecure because we're using Caddy's internal CA locally
    local status
    status=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 8 "$url" 2>/dev/null || echo "000")

    if [[ "$status" == "$expect" ]]; then
        echo "  ✅  $name"
        ((PASS++))
    else
        echo "  ❌  $name  (got $status, expected $expect)"
        ((FAIL++))
    fi
}

echo ""
echo "🩺 Photo Booth OS Health Check"
echo "   Domain: $DOMAIN_BASE"
echo "   Time:   $(date)"
echo ""

check "Caddy (dashboard)"     "https://dashboard.${DOMAIN_BASE}"       "200"
check "Twenty CRM"            "https://crm.${DOMAIN_BASE}"             "200"
check "Invoice Ninja"         "https://invoice.${DOMAIN_BASE}"          "200"
check "DocuSeal"              "https://contracts.${DOMAIN_BASE}"        "200"
check "InvenTree"             "https://inventory.${DOMAIN_BASE}"        "302"   # 302 = redirect to login (expected for unauthenticated)
check "Listmonk"              "https://email.${DOMAIN_BASE}"            "200"
check "n8n"                   "https://automation.${DOMAIN_BASE}"       "200"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed  |  $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "💡 Tip: Check container logs with:"
    echo "   docker compose logs -f [service-name]"
    exit 1
fi

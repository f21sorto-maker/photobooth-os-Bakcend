#!/usr/bin/env bash
# =============================================================================
# init-databases.sh — Idempotent database creation for Photo Booth OS
# =============================================================================
# Usage: bash scripts/init-databases.sh
# Requires: docker compose is running and postgres container is healthy
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ .env file not found. Run: cp .env.example .env && fill it in first."
    exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

POSTGRES_CONTAINER="photobooth-postgres"
DB_USER="${POSTGRES_USER}"

DATABASES=(
    "twenty_db"
    # NOTE: Invoice Ninja uses its own MariaDB container (ninja-db), not PostgreSQL
    "docuseal_db"
    "inventree_db"
    "listmonk_db"
    "n8n_db"
    "calcom_db"
)

# -----------------------------------------------------------------------------
# 1. Wait for PostgreSQL
# -----------------------------------------------------------------------------
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec "$POSTGRES_CONTAINER" pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [[ $i -eq 30 ]]; then
        echo "❌ PostgreSQL did not become ready within 30 seconds"
        exit 1
    fi
    sleep 1
done

echo ""
echo "🗄️  Creating databases (idempotent)..."

# -----------------------------------------------------------------------------
# 2. Idempotent DB creation — check existence in bash, then CREATE outside DO block
# -----------------------------------------------------------------------------
for db in "${DATABASES[@]}"; do
    EXISTS=$(docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname='${db}';" 2>/dev/null | tr -d '[:space:]' || echo "")
    
    if [[ "$EXISTS" == "1" ]]; then
        echo "   ⏭️  $db already exists — skipping"
    else
        if docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres \
            -c "CREATE DATABASE ${db};" >/dev/null 2>&1; then
            echo "   ✅ Created $db"
        else
            echo "   ❌ Failed to create $db"
            exit 1
        fi
    fi
done

echo ""
echo "🔐 Granting privileges..."

# -----------------------------------------------------------------------------
# 3. Grant privileges (safe to re-run)
# -----------------------------------------------------------------------------
for db in "${DATABASES[@]}"; do
    if docker exec -i "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d postgres \
        -c "GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${DB_USER};" >/dev/null 2>&1; then
        echo "   ✅ Privileges granted on $db"
    else
        echo "   ⚠️  Could not grant on $db (may already be owner)"
    fi
done

echo ""
echo "🎉 All databases initialized successfully:"
for db in "${DATABASES[@]}"; do
    echo "   • $db"
done
echo ""

# -----------------------------------------------------------------------------
# 4. Listmonk needs a one-time --install to create its schema.
#    Without this, photobooth-listmonk crash-loops with:
#       "the database does not appear to be setup. Run --install."
#    which makes https://email.<DOMAIN_BASE> return 502 Bad Gateway from Caddy.
#    The --idempotent flag makes this safe to re-run.
# -----------------------------------------------------------------------------
echo "📬 Installing Listmonk schema (idempotent)..."
if (cd "$PROJECT_ROOT" && docker compose run --rm listmonk \
        ./listmonk --install --idempotent --yes >/dev/null 2>&1); then
    echo "   ✅ Listmonk schema ready"
else
    echo "   ⚠️  Listmonk install command failed — check 'docker compose logs listmonk'"
fi

# -----------------------------------------------------------------------------
# 5. InvenTree needs migrations applied on first run (and after upgrades).
#    Without this, photobooth-inventree crash-loops with:
#       "INVE-W8: Database Migrations required"
#    which makes https://inventory.<DOMAIN_BASE> return 502 Bad Gateway.
#    `invoke update` runs migrations + collects static files (takes 2–5 min).
# -----------------------------------------------------------------------------
echo "📦 Running InvenTree migrations (this may take 2–5 minutes)..."
if (cd "$PROJECT_ROOT" && docker compose run --rm inventree \
        invoke update >/dev/null 2>&1); then
    echo "   ✅ InvenTree migrations applied"
    # Make sure the long-running container picks up the migrated DB
    (cd "$PROJECT_ROOT" && docker compose restart inventree >/dev/null 2>&1) || true
else
    echo "   ⚠️  InvenTree migration failed — check 'docker compose logs inventree'"
fi

echo ""
echo "✅ Database init complete. Run 'bash scripts/healthcheck.sh' to verify all services."
echo ""


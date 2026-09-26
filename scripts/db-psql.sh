#!/usr/bin/env bash
# psql against the project's Neon database.
#
# Solves two things the bare `psql "$DATABASE_URL"` cannot:
#   1. DATABASE_URL lives in .env and is not exported into the shell.
#   2. That URL points at Neon's -pooler endpoint. The pooler speaks a subset of
#      the protocol and is the wrong target for DDL, so strip it and connect direct.
#
# The URL is never echoed, so it stays out of the terminal and out of logs.
#
# Usage:
#   ./scripts/db-psql.sh                                  # interactive shell
#   ./scripts/db-psql.sh -c 'SELECT count(*) FROM fm_station;'
#   ./scripts/db-psql.sh -f prisma/migrations/<name>/migration.sql
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f .env ] || { echo "db-psql: no .env in $(pwd)" >&2; exit 1; }

url=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2-)
url=${url%\"}; url=${url#\"}          # strip surrounding double quotes
url=${url%\'}; url=${url#\'}          # strip surrounding single quotes
[ -n "$url" ] || { echo "db-psql: DATABASE_URL is empty in .env" >&2; exit 1; }

url=${url/-pooler/}                   # direct connection, not the pooler

command -v psql >/dev/null || {
  echo "db-psql: psql not on PATH. Homebrew keeps libpq keg-only:" >&2
  echo '  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >&2
  exit 1
}

exec psql "$url" -v ON_ERROR_STOP=1 "$@"

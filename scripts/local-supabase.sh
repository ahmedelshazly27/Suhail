#!/usr/bin/env bash
# Local Supabase core for development and CI: Postgres + GoTrue + PostgREST + a router on :54321.
# Writes .env.test.local with the URL and keys. Usage: scripts/local-supabase.sh [start|stop]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${LOCALSB_DIR:-/opt/localsb}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
SECRET="local-jwt-secret-local-jwt-secret-0123456789"
mkdir -p "$DIR"; cd "$DIR"

if [ "${1:-start}" = "stop" ]; then
  pkill -f "$DIR/postgrest" || true; pkill -f "$DIR/auth" || true; pkill -f scripts/local/router.mjs || true
  su postgres -c "$PGBIN/pg_ctl -D $DIR/pgdata stop" || true; exit 0
fi

[ -x "$DIR/postgrest" ] || { curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ; }
[ -x "$DIR/auth" ] || { curl -sSL https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz | tar xz; }

if [ ! -d "$DIR/pgdata" ]; then
  mkdir -p "$DIR/pgdata" && chown postgres "$DIR" "$DIR/pgdata"
  su postgres -c "$PGBIN/initdb -D $DIR/pgdata -U postgres --auth=trust -E UTF8 >/dev/null"
  echo "wal_level = logical" >> "$DIR/pgdata/postgresql.conf"
fi
su postgres -c "$PGBIN/pg_ctl -D $DIR/pgdata -o '-p 54322 -k /tmp' -l $DIR/pg.log start" >/dev/null || true
sleep 2
PSQL="psql -h /tmp -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"
$PSQL -f "$ROOT/scripts/local/bootstrap.sql"

# GoTrue creates the auth schema (auth.users, auth.uid()) before our migrations reference it.
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:local@127.0.0.1:54322/postgres?sslmode=disable"
export GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role
export API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" PORT=9999 GOTRUE_API_HOST=127.0.0.1
export GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_LOG_LEVEL=warn
pgrep -f "$DIR/auth" >/dev/null || (nohup "$DIR/auth" > "$DIR/auth.log" 2>&1 &)
for i in $(seq 1 30); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done

# Our migrations, recorded like the Supabase CLI does.
$PSQL -c "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[]);"
for f in "$ROOT"/supabase/migrations/*.sql; do
  v=$(basename "$f" | cut -d_ -f1)
  if [ -z "$($PSQL -tAc "select 1 from supabase_migrations.schema_migrations where version='$v'")" ]; then
    $PSQL -1 -f "$f" && $PSQL -c "insert into supabase_migrations.schema_migrations (version, name) values ('$v', '$(basename "$f")')"
  fi
done
$PSQL -c "grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; grant execute on all functions in schema public to service_role; notify pgrst, 'reload schema';"

export PGRST_DB_URI="postgres://authenticator:local@127.0.0.1:54322/postgres" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$SECRET" PGRST_SERVER_PORT=3001
pgrep -f "$DIR/postgrest" >/dev/null || (nohup "$DIR/postgrest" > "$DIR/postgrest.log" 2>&1 &)
pgrep -f scripts/local/router.mjs >/dev/null || (nohup node "$ROOT/scripts/local/router.mjs" > "$DIR/router.log" 2>&1 &)

# HS256 keys for the anon and service roles
jwt() { node -e 'const c=require("crypto");const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const h=b({alg:"HS256",typ:"JWT"}),p=b({role:process.argv[2],iss:"supabase",iat:1700000000,exp:2000000000});console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[1]).update(h+"."+p).digest("base64url"))' "$SECRET" "$1"; }
cat > "$ROOT/.env.test.local" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(jwt anon)
SUPABASE_SERVICE_ROLE_KEY=$(jwt service_role)
DEV_LOGIN=1
OWNER_EMAIL=a.elshazly@suhail.build
MAIL_ALLOWLIST=a.elshazly@suhail.build
ENV
sleep 2; curl -sf -o /dev/null http://127.0.0.1:54321/rest/v1/ -H "apikey: $(jwt anon)" && echo "local supabase ready on :54321"

// Applies supabase/migrations/*.sql to a Supabase project through the Management API, recording each in
// supabase_migrations.schema_migrations (the same table the Supabase CLI uses), so either tool can take over.
// Usage: SUPABASE_PROJECT_REF=... [SUPABASE_ACCESS_TOKEN=...] node scripts/db-push.mjs
import fs from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF || process.argv[2];
if (!ref) throw new Error("set SUPABASE_PROJECT_REF");
const headers = { "content-type": "application/json" };
if (process.env.SUPABASE_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`; // in this dev container a proxy adds it

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: "POST", headers, body: JSON.stringify({ query }) });
  const body = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${body}`);
  return JSON.parse(body || "[]");
}

await sql(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
const done = new Set((await sql("select version from supabase_migrations.schema_migrations")).map((r) => r.version));
const files = fs.readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  const [version, ...rest] = f.replace(".sql", "").split("_");
  if (done.has(version)) continue;
  const body = fs.readFileSync(`supabase/migrations/${f}`, "utf8");
  const esc = (s) => "$m$" + s + "$m$";
  await sql(`begin;\n${body}\n;insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${rest.join("_")}', array[${esc(body)}]);\ncommit;`);
  console.log(`${ref}: applied ${f}`);
}
console.log(`${ref}: up to date (${files.length} migrations)`);

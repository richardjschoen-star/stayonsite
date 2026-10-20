// Local D1 helper for `npm run dev`. cf's `d1 migrations apply` needs a real
// database id, so locally we go through the dev server's explorer API instead,
// keeping the same `d1_migrations` bookkeeping table wrangler/cf use.
//
//   node scripts/db-local.mjs                 apply new migrations/*.sql
//   node scripts/db-local.mjs seed            also run scripts/seed.sql
//   node scripts/db-local.mjs "SELECT …"      run one statement, print rows
import { readdirSync, readFileSync } from "node:fs";

const API = `${process.env.DEV_URL ?? "http://localhost:5173"}/cdn-cgi/local/explorer/api`;

async function call(path, body) {
  const res = await fetch(API + path, body && { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(`${path}: ${JSON.stringify(json?.errors ?? res.status)}`);
  return json.result;
}

const [db] = await call("/d1/database").catch(() => {
  throw new Error("Start `npm run dev` first.");
});
const sql = (q) => call(`/d1/database/${db.uuid}/raw`, { sql: q });

await sql("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)");
const done = new Set((await sql("SELECT name FROM d1_migrations"))[0].results.rows.map((r) => r[0]));

for (const name of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(name)) continue;
  await sql(readFileSync(`migrations/${name}`, "utf8"));
  await sql(`INSERT INTO d1_migrations (name) VALUES ('${name}')`);
  console.log(`applied ${name}`);
}

const arg = process.argv[2];
if (arg === "seed") {
  await sql(readFileSync("scripts/seed.sql", "utf8"));
  console.log("seeded");
} else if (arg) {
  for (const r of await sql(arg)) console.table(r.results.rows.map((row) => Object.fromEntries(r.results.columns.map((c, i) => [c, row[i]]))));
}

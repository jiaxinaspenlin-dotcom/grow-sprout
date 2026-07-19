// Polls Neon until the first user signs in, prints them, then exits.
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (;;) {
  const { rows } = await client.query(
    `select u.name, u.email, string_agg(a.provider, ', ') as providers
     from "User" u left join "Account" a on a."userId" = u.id group by u.id`
  );
  if (rows.length) {
    for (const r of rows) console.log(`SIGNED IN: ${r.name ?? "(no name)"} <${r.email ?? "no-email"}> via ${r.providers ?? "—"}`);
    break;
  }
  await new Promise((res) => setTimeout(res, 3000));
}
await client.end();

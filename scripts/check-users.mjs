// Quick check: who has signed in (rows persisted by the next-auth Prisma adapter).
import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `select u.name, u.email, string_agg(a.provider, ', ') as providers
   from "User" u left join "Account" a on a."userId" = u.id
   group by u.id order by u."createdAt"`
);
console.log(`Users in Neon: ${rows.length}`);
for (const r of rows) console.log(` • ${r.name ?? "(no name)"} <${r.email ?? "no-email"}> via ${r.providers ?? "—"}`);
await client.end();

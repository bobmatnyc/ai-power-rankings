import { getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();
  if (!db) {
    console.log("No database connection");
    process.exit(1);
  }

  const results = await db
    .select()
    .from(tools)
    .where(
      sql`${tools.name} LIKE '%Claude%' OR ${tools.name} LIKE '%ChatGPT%'`
    )
    .limit(20);

  console.log(JSON.stringify(results, null, 2));
}

main();

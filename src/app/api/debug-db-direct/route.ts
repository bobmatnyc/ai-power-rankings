import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const result: any = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      hasDbUrl: !!process.env["SUPABASE_DATABASE_URL"],
    },
    database: {
      connected: false,
      error: null,
      toolsCount: 0,
      tables: [],
    },
  };

  // Only try to connect if we have a database URL
  if (!process.env["SUPABASE_DATABASE_URL"]) {
    result.database.error = "No database URL configured";
    return NextResponse.json(result);
  }

  const client = new Client({
    connectionString: process.env["SUPABASE_DATABASE_URL"],
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    result.database.connected = true;

    // List all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    result.database.tables = tablesResult.rows.map((r: any) => r.table_name);

    // Try to count tools directly
    try {
      const countResult = await client.query("SELECT COUNT(*) FROM tools");
      result.database.toolsCount = parseInt(countResult.rows[0].count);
    } catch (err) {
      result.database.toolsTableError = err instanceof Error ? err.message : String(err);
    }

    // Check if payload schema exists
    try {
      const schemaResult = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'payload'
      `);
      result.database.payloadSchemaExists = schemaResult.rows.length > 0;

      if (result.database.payloadSchemaExists) {
        // List payload tables
        const payloadTablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'payload' 
          ORDER BY table_name
        `);
        result.database.payloadTables = payloadTablesResult.rows.map((r: any) => r.table_name);

        // Try to count payload.tools
        try {
          const payloadCountResult = await client.query("SELECT COUNT(*) FROM payload.tools");
          result.database.payloadToolsCount = parseInt(payloadCountResult.rows[0].count);
        } catch (err) {
          result.database.payloadToolsError = err instanceof Error ? err.message : String(err);
        }
      }
    } catch (err) {
      result.database.schemaError = err instanceof Error ? err.message : String(err);
    }
  } catch (error) {
    result.database.error = error instanceof Error ? error.message : String(error);
  } finally {
    await client.end();
  }

  return NextResponse.json(result);
}

import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  statement_timeout: 10_000, // 10s max per query
});

export async function executeQuery(sql: string, schemaName = "public") {
  const client = await pool.connect();
  try {
    // Set search_path so unqualified table names resolve to the selected schema
    // Sanitize schema name: only allow alphanumeric, underscores, and hyphens
    const safeName = schemaName.replace(/[^a-zA-Z0-9_\-]/g, "");
    await client.query(`SET search_path TO "${safeName}", public`);
    const result = await client.query(sql);
    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    client.release();
  }
}

export async function rawQuery<T extends pg.QueryResultRow>(sql: string, params?: unknown[]) {
  const result = await pool.query<T>(sql, params);
  return result.rows;
}

export { pool };

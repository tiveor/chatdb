import { rawQuery } from "./database.js";
import type { TableSchema } from "../types.js";

const cache = new Map<string, { text: string; time: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function listSchemas(): Promise<string[]> {
  const rows = await rawQuery<{ schema_name: string }>(`
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `);
  return rows.map((r) => r.schema_name);
}

export async function getSchemaText(schemaName = "public"): Promise<string> {
  const now = Date.now();
  const cached = cache.get(schemaName);
  if (cached && now - cached.time < CACHE_TTL) {
    return cached.text;
  }

  const rows = await rawQuery<TableSchema>(`
    SELECT
      t.table_name,
      c.column_name,
      c.data_type,
      c.is_nullable
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = $1
      AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position
  `, [schemaName]);

  const tables = new Map<string, TableSchema[]>();
  for (const row of rows) {
    const list = tables.get(row.table_name) ?? [];
    list.push(row);
    tables.set(row.table_name, list);
  }

  // Compact format to save tokens: table(col1 type,col2 type,...)
  const lines: string[] = [];
  for (const [table, columns] of tables) {
    const cols = columns.map((c) => `${c.column_name} ${c.data_type}`).join(", ");
    lines.push(`${table}(${cols})`);
  }

  const text = lines.join("\n");
  cache.set(schemaName, { text, time: now });
  return text;
}

export async function listTables(schemaName = "public"): Promise<string[]> {
  const rows = await rawQuery<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schemaName]);
  return rows.map((r) => r.table_name);
}

export function invalidateSchemaCache() {
  cache.clear();
}

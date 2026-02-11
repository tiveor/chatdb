import type { DatabaseDialect } from "../types.js";
import { DatabaseError } from "../utils/errors.js";
import { BaseDatabaseAdapter } from "./base.js";
import type { QueryResultRaw, TableColumnInfo } from "./types.js";

export class SQLiteAdapter extends BaseDatabaseAdapter {
  readonly dialect: DatabaseDialect = "sqlite";
  readonly defaultSchema = "main";
  private db: any = null;

  constructor(private filePath: string) {
    super();
  }

  private async getDb() {
    if (!this.db) {
      let Database: any;
      try {
        const mod = await import("better-sqlite3");
        Database = mod.default ?? mod;
      } catch {
        throw new DatabaseError(
          "SQLite driver not found. Install it: npm install better-sqlite3",
          this.dialect,
        );
      }
      this.db = new Database(this.filePath, { readonly: true });
      try { this.db.pragma("journal_mode = WAL"); } catch { /* readonly db */ }
    }
    return this.db;
  }

  async execute(sql: string): Promise<QueryResultRaw> {
    const db = await this.getDb();
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : (stmt.columns?.()?.map((c: any) => c.name) ?? []);
      return {
        columns,
        rows,
        rowCount: rows.length,
      };
    } catch (err: any) {
      throw new DatabaseError(err.message, this.dialect);
    }
  }

  async rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const db = await this.getDb();
    const stmt = db.prepare(sql);
    return params ? stmt.all(...params) : stmt.all();
  }

  async getColumns(): Promise<TableColumnInfo[]> {
    const tables = await this.listTables();
    const result: TableColumnInfo[] = [];

    for (const tableName of tables) {
      const columns = await this.rawQuery<{
        name: string;
        type: string;
      }>(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`);

      for (const col of columns) {
        result.push({
          tableName,
          columnName: col.name,
          dataType: col.type || "TEXT",
        });
      }
    }

    return result;
  }

  async listSchemas(): Promise<string[]> {
    return ["main"];
  }

  async listTables(): Promise<string[]> {
    const rows = await this.rawQuery<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    return rows.map((r) => r.name);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

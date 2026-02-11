import type { DatabaseDialect } from "../types.js";
import { DatabaseError } from "../utils/errors.js";
import { BaseDatabaseAdapter } from "./base.js";
import type { QueryResultRaw, TableColumnInfo } from "./types.js";

export class MySQLAdapter extends BaseDatabaseAdapter {
  readonly dialect: DatabaseDialect = "mysql";
  readonly defaultSchema: string;
  private pool: any = null;

  constructor(
    private connectionString: string,
    private poolSize = 5,
    private timeout = 10_000,
  ) {
    super();
    // Extract database name from connection string for default schema
    const match = connectionString.match(/:\/\/[^/]*\/([^/?]+)/);
    this.defaultSchema = match?.[1] ?? "mysql";
  }

  private async getPool() {
    if (!this.pool) {
      let mysql: any;
      try {
        mysql = await import("mysql2/promise");
      } catch {
        throw new DatabaseError(
          "MySQL driver not found. Install it: npm install mysql2",
          this.dialect,
        );
      }
      const createPool = mysql.default?.createPool ?? mysql.createPool;
      this.pool = createPool({
        uri: this.connectionString,
        connectionLimit: this.poolSize,
        connectTimeout: this.timeout,
      });
    }
    return this.pool;
  }

  async execute(sql: string, schema?: string): Promise<QueryResultRaw> {
    const pool = await this.getPool();
    try {
      if (schema) {
        const safeName = schema.replace(/[^a-zA-Z0-9_\-]/g, "");
        await pool.query(`USE \`${safeName}\``);
      }
      const [rows, fields] = await pool.query(sql);
      return {
        columns: fields?.map((f: any) => f.name) ?? [],
        rows: Array.isArray(rows) ? rows : [],
        rowCount: Array.isArray(rows) ? rows.length : 0,
      };
    } catch (err: any) {
      throw new DatabaseError(err.message, this.dialect);
    }
  }

  async rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const pool = await this.getPool();
    const [rows] = await pool.query(sql, params);
    return rows as T[];
  }

  async getColumns(schemaName?: string): Promise<TableColumnInfo[]> {
    const db = schemaName ?? this.defaultSchema;
    const rows = await this.rawQuery<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      DATA_TYPE: string;
    }>(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [db],
    );
    return rows.map((r) => ({
      tableName: r.TABLE_NAME,
      columnName: r.COLUMN_NAME,
      dataType: r.DATA_TYPE,
    }));
  }

  async listSchemas(): Promise<string[]> {
    const rows = await this.rawQuery<{ Database: string }>("SHOW DATABASES");
    const system = ["information_schema", "mysql", "performance_schema", "sys"];
    return rows.map((r) => r.Database).filter((d) => !system.includes(d));
  }

  async listTables(schemaName?: string): Promise<string[]> {
    const db = schemaName ?? this.defaultSchema;
    const rows = await this.rawQuery<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [db],
    );
    return rows.map((r) => r.TABLE_NAME);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

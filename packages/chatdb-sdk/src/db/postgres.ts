import type { DatabaseDialect } from "../types.js";
import { DatabaseError } from "../utils/errors.js";
import { BaseDatabaseAdapter } from "./base.js";
import type { QueryResultRaw, TableColumnInfo } from "./types.js";

export class PostgresAdapter extends BaseDatabaseAdapter {
  readonly dialect: DatabaseDialect = "postgresql";
  readonly defaultSchema = "public";
  private pool: any = null;

  constructor(
    private connectionString: string,
    private poolSize = 5,
    private timeout = 10_000,
  ) {
    super();
  }

  private async getPool() {
    if (!this.pool) {
      let pg: any;
      try {
        pg = await import("pg");
      } catch {
        throw new DatabaseError(
          'PostgreSQL driver not found. Install it: npm install pg',
          this.dialect,
        );
      }
      const Pool = pg.default?.Pool ?? pg.Pool;
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: this.poolSize,
        statement_timeout: this.timeout,
      });
    }
    return this.pool;
  }

  async execute(sql: string, schema = "public"): Promise<QueryResultRaw> {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      const safeName = schema.replace(/[^a-zA-Z0-9_\-]/g, "");
      await client.query(`SET search_path TO "${safeName}", public`);
      const result = await client.query(sql);
      return {
        columns: result.fields.map((f: any) => f.name),
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
    } catch (err: any) {
      throw new DatabaseError(err.message, this.dialect);
    } finally {
      client.release();
    }
  }

  async rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const pool = await this.getPool();
    const result = await pool.query(sql, params);
    return result.rows;
  }

  async getColumns(schemaName = "public"): Promise<TableColumnInfo[]> {
    const rows = await this.rawQuery<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `SELECT t.table_name, c.column_name, c.data_type
       FROM information_schema.tables t
       JOIN information_schema.columns c
         ON t.table_name = c.table_name AND t.table_schema = c.table_schema
       WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'
       ORDER BY t.table_name, c.ordinal_position`,
      [schemaName],
    );
    return rows.map((r) => ({
      tableName: r.table_name,
      columnName: r.column_name,
      dataType: r.data_type,
    }));
  }

  async listSchemas(): Promise<string[]> {
    const rows = await this.rawQuery<{ schema_name: string }>(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`,
    );
    return rows.map((r) => r.schema_name);
  }

  async listTables(schemaName = "public"): Promise<string[]> {
    const rows = await this.rawQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [schemaName],
    );
    return rows.map((r) => r.table_name);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

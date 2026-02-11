import type { DatabaseDialect } from "../types.js";
import type { DatabaseAdapter, QueryResultRaw, TableColumnInfo } from "./types.js";

export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  abstract readonly dialect: DatabaseDialect;
  abstract readonly defaultSchema: string;

  abstract execute(sql: string, schema?: string): Promise<QueryResultRaw>;
  abstract rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  abstract getColumns(schemaName?: string): Promise<TableColumnInfo[]>;
  abstract listSchemas(): Promise<string[]>;
  abstract listTables(schemaName?: string): Promise<string[]>;
  abstract close(): Promise<void>;

  /** Compact schema format for LLM consumption: "users(id bigint, name varchar)" */
  async getSchemaText(schemaName?: string): Promise<string> {
    const columns = await this.getColumns(schemaName ?? this.defaultSchema);
    const tables = new Map<string, TableColumnInfo[]>();
    for (const col of columns) {
      const list = tables.get(col.tableName) ?? [];
      list.push(col);
      tables.set(col.tableName, list);
    }
    const lines: string[] = [];
    for (const [table, cols] of tables) {
      const colStr = cols.map((c) => `${c.columnName} ${c.dataType}`).join(", ");
      lines.push(`${table}(${colStr})`);
    }
    return lines.join("\n");
  }
}

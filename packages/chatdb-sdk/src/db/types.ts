import type { DatabaseDialect } from "../types.js";

export interface QueryResultRaw {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface TableColumnInfo {
  tableName: string;
  columnName: string;
  dataType: string;
}

export interface DatabaseAdapter {
  readonly dialect: DatabaseDialect;
  readonly defaultSchema: string;

  execute(sql: string, schema?: string): Promise<QueryResultRaw>;
  rawQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  getSchemaText(schemaName?: string): Promise<string>;
  listSchemas(): Promise<string[]>;
  listTables(schemaName?: string): Promise<string[]>;
  getColumns(schemaName?: string): Promise<TableColumnInfo[]>;
  close(): Promise<void>;
}

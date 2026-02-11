export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  schemaName?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  data?: QueryResult;
}

export interface QueryResult {
  sql: string;
  explanation: string;
  chartType: "bar" | "line" | "pie" | "table" | "number";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface OllamaResponse {
  sql: string;
  explanation: string;
  chartType: "bar" | "line" | "pie" | "table" | "number";
}

export interface TableSchema {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
}

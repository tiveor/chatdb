export interface QueryResult {
  sql: string;
  explanation: string;
  chartType: "bar" | "line" | "pie" | "table" | "number";
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  data?: QueryResult;
  loading?: boolean;
  contextOverflow?: boolean;
}

export interface ChatResponse {
  text: string;
  data: QueryResult | null;
  contextOverflow?: boolean;
  logs?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  lines: string[];
  isError: boolean;
}

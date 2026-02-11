export type { ChatMessage, QueryResult } from "@tiveor/chatdb";
import type { ChatMessage } from "@tiveor/chatdb";

export interface ChatRequest {
  message: string;
  history: ChatMessage[];
  schemaName?: string;
}

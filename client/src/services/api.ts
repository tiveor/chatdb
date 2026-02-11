import type { ChatMessage, ChatResponse } from "../types";

export async function sendMessage(
  message: string,
  history: ChatMessage[],
  schemaName: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      schemaName,
      history: history
        .filter((m) => !m.loading)
        .map((m) => ({
          role: m.role,
          content: m.content,
          data: m.data,
        })),
    }),
  });

  // Always parse the body — the server returns logs and error details even on 500
  const data: ChatResponse = await res.json();
  return data;
}

export async function fetchSchemas(): Promise<string[]> {
  const res = await fetch("/api/schema/list");
  if (!res.ok) throw new Error("Failed to fetch schemas");
  const data = await res.json();
  return data.schemas;
}

export async function fetchTables(schemaName: string): Promise<string[]> {
  const res = await fetch(`/api/schema/tables?name=${encodeURIComponent(schemaName)}`);
  if (!res.ok) throw new Error("Failed to fetch tables");
  const data = await res.json();
  return data.tables;
}

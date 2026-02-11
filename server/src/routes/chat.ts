import { Hono } from "hono";
import type { ChatDB } from "@tiveor/chatdb";
import { ValidationError, ContextOverflowError } from "@tiveor/chatdb";
import type { ChatRequest } from "../types.js";

export function createChatRoutes(chatdb: ChatDB) {
  const chat = new Hono();

  chat.post("/", async (c) => {
    const body = await c.req.json<ChatRequest>();
    const { message, history, schemaName } = body;

    if (!message?.trim()) {
      return c.json({ error: "Message is required" }, 400);
    }

    const schema = schemaName || "public";
    const logs: string[] = [`Schema: ${schema}`];

    try {
      const result = await chatdb.query(message, { schema, history: history ?? [] });

      if (result.debug) {
        logs.push(`Model: ${result.debug.model}`);
        logs.push(`Context: ${result.debug.contextLength} tokens`);
        logs.push(`System: ${result.debug.systemTokens} | User: ${result.debug.userTokens} | History: ${result.debug.historyTokens} (${result.debug.historyMessages} msgs)`);
        logs.push(`Schema truncated: ${result.debug.schemaTruncated}`);
        logs.push(`Duration: ${result.debug.durationMs}ms`);
      }
      logs.push(`Chart type: ${result.chartType}`);
      logs.push(`Generated SQL: ${result.sql}`);

      return c.json({
        text: result.explanation,
        data: {
          sql: result.sql,
          explanation: result.explanation,
          chartType: result.chartType,
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rowCount,
        },
        logs,
      });
    } catch (err) {
      if (err instanceof ValidationError) {
        logs.push(`BLOCKED: ${err.message}`);
        return c.json({
          text: `I generated a query but it was blocked for safety: ${err.message}`,
          data: null,
          logs,
        });
      }

      if (err instanceof ContextOverflowError) {
        logs.push(`ERROR: CONTEXT_OVERFLOW`);
        return c.json({
          text: "The conversation is too long for this model's context window. Please start a new conversation.",
          data: null,
          contextOverflow: true,
          logs,
        });
      }

      const error = err instanceof Error ? err.message : "Unknown error";
      logs.push(`ERROR: ${error}`);

      return c.json(
        {
          text: `Sorry, something went wrong: ${error}`,
          data: null,
          logs,
        },
        500
      );
    }
  });

  return chat;
}

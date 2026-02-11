import { Hono } from "hono";
import { generateSQL } from "../services/ollama.js";
import { getSchemaText } from "../services/schema.js";
import { validateSQL, ensureLimit } from "../services/sql-guard.js";
import { executeQuery } from "../services/database.js";
import type { ChatRequest } from "../types.js";

const chat = new Hono();

chat.post("/", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { message, history, schemaName } = body;

  if (!message?.trim()) {
    return c.json({ error: "Message is required" }, 400);
  }

  const logs: string[] = [];
  const selectedSchema = schemaName || "public";
  logs.push(`Schema: ${selectedSchema}`);

  try {
    // 1. Get database schema
    const schema = await getSchemaText(selectedSchema);
    logs.push(`Schema text: ${schema.length} chars`);

    // 2. Ask AI to generate SQL
    const { response: aiResponse, debug } = await generateSQL(schema, history ?? [], message, selectedSchema);
    logs.push(`Model: ${debug.model}`);
    logs.push(`Context: ${debug.contextLength} tokens`);
    logs.push(`System: ${debug.systemTokens} | User: ${debug.userTokens} | History: ${debug.historyTokens} (${debug.historyMessages} msgs)`);
    logs.push(`Schema truncated: ${debug.schemaTruncated}`);
    logs.push(`Duration: ${debug.durationMs}ms`);

    // 3. Clean up SQL
    aiResponse.sql = aiResponse.sql
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\\\/g, "\\")
      .trim();

    // Strip schema prefix from table names (AI sometimes adds it despite instructions)
    // Matches: schema_name.table or "schema-name".table
    const schemaPrefix = new RegExp(`(?:"?${selectedSchema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?\\.)|(?:${selectedSchema.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.)`, 'gi');
    aiResponse.sql = aiResponse.sql.replace(schemaPrefix, '');

    logs.push(`Chart type: ${aiResponse.chartType ?? "table"}`);
    logs.push(`Generated SQL: ${aiResponse.sql}`);

    // 4. Validate the generated SQL
    const validation = validateSQL(aiResponse.sql);
    if (!validation.valid) {
      logs.push(`BLOCKED: ${validation.error}`);
      return c.json({
        text: `I generated a query but it was blocked for safety: ${validation.error}`,
        data: null,
        logs,
      });
    }

    logs.push("Validation: passed");

    // 5. Ensure LIMIT is present
    const safeSql = ensureLimit(aiResponse.sql);

    // 6. Execute query in the selected schema
    const startExec = Date.now();
    const result = await executeQuery(safeSql, selectedSchema);
    logs.push(`Query: ${Date.now() - startExec}ms, ${result.rowCount} rows`);

    return c.json({
      text: aiResponse.explanation,
      data: {
        sql: safeSql,
        explanation: aiResponse.explanation,
        chartType: aiResponse.chartType ?? "table",
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
      },
      logs,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    logs.push(`ERROR: ${error}`);

    if (error === "CONTEXT_OVERFLOW") {
      return c.json({
        text: "The conversation is too long for this model's context window. Please start a new conversation.",
        data: null,
        contextOverflow: true,
        logs,
      });
    }

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

export default chat;

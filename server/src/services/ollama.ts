import type { ChatMessage, OllamaResponse } from "../types.js";

const BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "";

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

let cachedContextLength: number | null = null;
let cachedModelId: string | null = null;

async function getModelInfo(): Promise<{ contextLength: number; modelId: string }> {
  if (cachedContextLength && cachedModelId) {
    return { contextLength: cachedContextLength, modelId: cachedModelId };
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/models`);
    if (res.ok) {
      const data = await res.json();
      const model = data.data?.[0];
      cachedModelId = model?.id ?? "unknown";
      cachedContextLength =
        model?.context_length ??
        model?.max_model_len ??
        model?.context_window ??
        4096;
      return { contextLength: cachedContextLength, modelId: cachedModelId };
    }
  } catch {
    // ignore
  }

  cachedContextLength = 4096;
  cachedModelId = "unknown";
  return { contextLength: 4096, modelId: "unknown" };
}

function buildRules(schemaName: string) {
  return `You are a SQL assistant for PostgreSQL. Generate a SELECT query from the user's question.
The active schema is "${schemaName}". NEVER prefix table names with the schema. Query tables directly (SELECT * FROM my_table). Do NOT add WHERE table_schema = '...' to regular tables — only use table_schema when querying information_schema.
Rules: ONLY SELECT, include LIMIT 1000, respond with JSON only.
When using GROUP BY, ALWAYS include an aggregate function (COUNT, SUM, AVG, etc.) as the second column so charts can render. Example: SELECT status, COUNT(*) FROM orders GROUP BY status.
Format: {"sql":"SELECT ...","explanation":"brief","chartType":"bar|line|pie|table|number"}
chartType: number=single value, line=time series, bar=categories with values, pie=proportions with counts, table=raw data.
Answer in the SAME LANGUAGE as the user.`;
}

function truncateSchema(schema: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (schema.length <= maxChars) return schema;
  const truncated = schema.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  return truncated.slice(0, lastNewline) + "\n... (schema truncated to fit context)";
}

export interface DebugInfo {
  model: string;
  contextLength: number;
  systemTokens: number;
  userTokens: number;
  historyTokens: number;
  historyMessages: number;
  availableTokens: number;
  schemaTruncated: boolean;
  generatedSql: string;
  rawResponse: string;
  durationMs: number;
}

interface BuildResult {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stats: {
    systemTokens: number;
    userTokens: number;
    historyTokens: number;
    historyMessages: number;
    availableTokens: number;
    schemaTruncated: boolean;
  };
}

function buildMessages(
  schema: string,
  history: ChatMessage[],
  message: string,
  maxTokens: number,
  schemaName: string
): BuildResult {
  const responseReserve = 256;
  const rules = buildRules(schemaName);
  const rulesTokens = estimateTokens(rules);
  const userTokens = estimateTokens(message);

  const schemabudget = maxTokens - rulesTokens - userTokens - responseReserve - 50;
  const trimmedSchema = truncateSchema(schema, Math.max(schemabudget, 200));
  const schemaTruncated = trimmedSchema.length < schema.length;

  const systemPrompt = `${rules}\n\nSCHEMA:\n${trimmedSchema}`;
  const systemMsg = { role: "system" as const, content: systemPrompt };
  const userMsg = { role: "user" as const, content: message };

  const systemTokens = estimateTokens(systemPrompt);
  const usedTokens = systemTokens + userTokens + responseReserve;
  let availableForHistory = maxTokens - usedTokens;

  if (availableForHistory <= 0) {
    return {
      messages: [systemMsg, userMsg],
      stats: { systemTokens, userTokens, historyTokens: 0, historyMessages: 0, availableTokens: availableForHistory, schemaTruncated },
    };
  }

  const historyMsgs: { role: "system" | "user" | "assistant"; content: string }[] = [];
  const recent = [...history].reverse();
  let historyTokens = 0;

  for (const msg of recent) {
    const content =
      msg.role === "user"
        ? msg.content
        : JSON.stringify({
            sql: msg.data?.sql ?? "",
            explanation: msg.content,
            chartType: msg.data?.chartType ?? "table",
          });

    const tokens = estimateTokens(content);
    if (tokens > availableForHistory) break;

    availableForHistory -= tokens;
    historyTokens += tokens;
    historyMsgs.unshift({ role: msg.role, content });
  }

  return {
    messages: [systemMsg, ...historyMsgs, userMsg],
    stats: { systemTokens, userTokens, historyTokens, historyMessages: historyMsgs.length, availableTokens: availableForHistory, schemaTruncated },
  };
}

export async function generateSQL(
  schema: string,
  history: ChatMessage[],
  message: string,
  schemaName: string
): Promise<{ response: OllamaResponse; debug: DebugInfo }> {
  const startTime = Date.now();
  const { contextLength, modelId } = await getModelInfo();
  const { messages, stats } = buildMessages(schema, history, message, contextLength, schemaName);

  const body: Record<string, unknown> = {
    messages,
    temperature: 0.1,
    max_tokens: 256,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sql_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            sql: { type: "string" },
            explanation: { type: "string" },
            chartType: { type: "string", enum: ["bar", "line", "pie", "table", "number"] },
          },
          required: ["sql", "explanation", "chartType"],
          additionalProperties: false,
        },
      },
    },
  };

  if (MODEL) body.model = MODEL;

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 && text.includes("context")) {
      throw new Error("CONTEXT_OVERFLOW");
    }
    throw new Error(`AI server error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  const durationMs = Date.now() - startTime;

  if (!content) {
    throw new Error("No response content from AI server");
  }

  const parsed = JSON.parse(content) as OllamaResponse;

  if (!parsed.sql || !parsed.explanation) {
    throw new Error("Invalid AI response: missing sql or explanation");
  }

  return {
    response: parsed,
    debug: {
      model: modelId,
      contextLength,
      ...stats,
      generatedSql: parsed.sql,
      rawResponse: content,
      durationMs,
    },
  };
}

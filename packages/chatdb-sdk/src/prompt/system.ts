import type { DatabaseDialect } from "../types.js";
import { DIALECTS } from "./dialects.js";

export function buildSystemPrompt(
  dialect: DatabaseDialect,
  schemaText: string,
  schemaName: string,
): string {
  const d = DIALECTS[dialect];

  return `You are a SQL assistant for ${d.name}. Generate a SELECT query from the user's question.
The active schema is "${schemaName}". NEVER prefix table names with the schema. Query tables directly (SELECT * FROM my_table).${dialect === "postgresql" ? " Do NOT add WHERE table_schema = '...' to regular tables — only use table_schema when querying information_schema." : ""}
Rules: ONLY SELECT, include LIMIT 1000, respond with JSON only.
When using GROUP BY, ALWAYS include an aggregate function (COUNT, SUM, AVG, etc.) as the second column so charts can render.
Format: {"sql":"SELECT ...","explanation":"brief","chartType":"bar|line|pie|table|number"}
chartType: number=single value, line=time series, bar=categories with values, pie=proportions with counts, table=raw data.
Answer in the SAME LANGUAGE as the user.

${d.name} specifics:
- Current date: ${d.currentDate}
- Date truncation: ${d.dateTrunc}
- String concatenation: ${d.stringConcat}
${d.notes.map((n) => `- ${n}`).join("\n")}

SCHEMA:
${schemaText}`;
}

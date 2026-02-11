/** Rough token estimate: ~4 chars per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Truncate schema text to fit within a token budget. */
export function truncateSchema(schema: string, maxTokens: number): { text: string; truncated: boolean } {
  const maxChars = maxTokens * 4;
  if (schema.length <= maxChars) return { text: schema, truncated: false };
  const truncated = schema.slice(0, maxChars);
  const lastNewline = truncated.lastIndexOf("\n");
  return {
    text: truncated.slice(0, lastNewline) + "\n... (schema truncated to fit context)",
    truncated: true,
  };
}

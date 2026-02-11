const BLOCKED_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
  "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "COPY",
];

export function validateSQL(
  sql: string,
  options?: { allowWrites?: boolean },
): { valid: boolean; error?: string } {
  if (options?.allowWrites) return { valid: true };

  const trimmed = sql.trim();

  if (!/^(SELECT|WITH)\s/i.test(trimmed)) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  // Remove string literals to avoid false positives on semicolons/keywords inside strings
  const withoutStrings = trimmed.replace(/'[^']*'/g, "''");
  if (withoutStrings.includes(";") && withoutStrings.indexOf(";") < withoutStrings.length - 1) {
    return { valid: false, error: "Multiple statements are not allowed." };
  }

  const upper = withoutStrings.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(upper)) {
      return { valid: false, error: `${keyword} operations are not allowed.` };
    }
  }

  return { valid: true };
}

export function ensureLimit(sql: string, maxRows = 1000): string {
  const trimmed = sql.trim().replace(/;$/, "");
  if (!/\bLIMIT\s+\d+/i.test(trimmed)) {
    return `${trimmed} LIMIT ${maxRows}`;
  }
  return trimmed;
}

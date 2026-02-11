const BLOCKED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "COPY",
];

const MAX_ROWS = 1000;

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  // Must start with SELECT or WITH (for CTEs)
  if (!/^(SELECT|WITH)\s/i.test(trimmed)) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  // Block multiple statements
  // Remove string literals first to avoid false positives on semicolons inside strings
  const withoutStrings = trimmed.replace(/'[^']*'/g, "''");
  if (withoutStrings.includes(";") && withoutStrings.indexOf(";") < withoutStrings.length - 1) {
    return { valid: false, error: "Multiple statements are not allowed." };
  }

  // Check for blocked keywords as standalone words
  const upper = withoutStrings.toUpperCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(upper)) {
      return { valid: false, error: `${keyword} operations are not allowed.` };
    }
  }

  return { valid: true };
}

export function ensureLimit(sql: string): string {
  const trimmed = sql.trim().replace(/;$/, "");
  if (!/\bLIMIT\s+\d+/i.test(trimmed)) {
    return `${trimmed} LIMIT ${MAX_ROWS}`;
  }
  return trimmed;
}

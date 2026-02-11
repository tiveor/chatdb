import type { DatabaseDialect } from "../types.js";

export interface SQLDialect {
  name: string;
  currentDate: string;
  dateTrunc: string;
  stringConcat: string;
  notes: string[];
}

export const DIALECTS: Record<DatabaseDialect, SQLDialect> = {
  postgresql: {
    name: "PostgreSQL",
    currentDate: "CURRENT_DATE",
    dateTrunc: "date_trunc('period', column)",
    stringConcat: "||",
    notes: [
      "Use ILIKE for case-insensitive matching.",
      "INTERVAL syntax: INTERVAL '1 month'.",
      "Supports CTEs (WITH ... AS).",
    ],
  },
  mysql: {
    name: "MySQL",
    currentDate: "CURDATE()",
    dateTrunc: "DATE_FORMAT(column, '%Y-%m-01')",
    stringConcat: "CONCAT(a, b)",
    notes: [
      "Use backticks for identifiers with special characters.",
      "LIKE is case-insensitive by default.",
      "INTERVAL syntax: INTERVAL 1 MONTH.",
      "Use IFNULL() instead of COALESCE() for two arguments.",
    ],
  },
  sqlite: {
    name: "SQLite",
    currentDate: "date('now')",
    dateTrunc: "strftime('%Y-%m', column)",
    stringConcat: "||",
    notes: [
      "No native DATE type — dates stored as TEXT or INTEGER.",
      "Use strftime() for date manipulation.",
      "No RIGHT JOIN or FULL OUTER JOIN.",
      "Use COALESCE() for null handling.",
    ],
  },
};

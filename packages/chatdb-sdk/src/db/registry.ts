import type { DatabaseConfig, DatabaseDialect } from "../types.js";
import { ChatDBError } from "../utils/errors.js";
import type { DatabaseAdapter } from "./types.js";

function detectDialect(url: string): DatabaseDialect {
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) return "postgresql";
  if (url.startsWith("mysql://")) return "mysql";
  if (
    url.endsWith(".sqlite") ||
    url.endsWith(".sqlite3") ||
    url.endsWith(".db") ||
    url.startsWith("sqlite://") ||
    url.startsWith("./") ||
    url.startsWith("/")
  ) {
    return "sqlite";
  }
  throw new ChatDBError(
    `Cannot detect database dialect from: ${url}. Use { url, dialect } config object.`,
  );
}

export async function resolveDatabaseAdapter(
  config: string | DatabaseConfig,
  timeout = 10_000,
): Promise<DatabaseAdapter> {
  const url = typeof config === "string" ? config : config.url;
  const poolSize = typeof config === "object" ? config.poolSize ?? 5 : 5;
  const dialect = (typeof config === "object" ? config.dialect : undefined) ?? detectDialect(url);

  switch (dialect) {
    case "postgresql": {
      const { PostgresAdapter } = await import("./postgres.js");
      return new PostgresAdapter(url, poolSize, timeout);
    }
    case "mysql": {
      const { MySQLAdapter } = await import("./mysql.js");
      return new MySQLAdapter(url, poolSize, timeout);
    }
    case "sqlite": {
      const { SQLiteAdapter } = await import("./sqlite.js");
      const path = url.startsWith("sqlite://") ? url.slice(9) : url;
      return new SQLiteAdapter(path);
    }
    default:
      throw new ChatDBError(`Unsupported database dialect: ${dialect}`);
  }
}

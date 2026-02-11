import { parseArgs } from "node:util";
import { ChatDB } from "../chatdb.js";
import { resolveConfig } from "./config.js";
import { printHelp, printTable } from "./output.js";
import { startRepl } from "./repl.js";

const { values } = parseArgs({
  options: {
    database: { type: "string", short: "d" },
    llm: { type: "string", short: "l" },
    "api-key": { type: "string", short: "k" },
    provider: { type: "string", short: "p" },
    model: { type: "string", short: "m" },
    schema: { type: "string", short: "s" },
    query: { type: "string", short: "q" },
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
  strict: false,
});

if (values.help) {
  printHelp();
  process.exit(0);
}

if (values.version) {
  console.log("@tiveor/chatdb v0.1.0");
  process.exit(0);
}

const config = resolveConfig(values as Record<string, string | boolean | undefined>);

if (values.query) {
  // Non-interactive single query mode
  const db = new ChatDB(config);
  try {
    const result = await db.query(values.query as string);
    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`\nSQL: ${result.sql}\n`);
      console.log(result.explanation + "\n");
      printTable(result);
      console.log(`${result.rowCount} rows | ${result.chartType}`);
    }
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    await db.close();
  }
} else {
  // Interactive REPL mode
  console.log("@tiveor/chatdb v0.1.0 - Chat with your database");
  await startRepl(config);
}

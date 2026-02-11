import * as readline from "node:readline";
import { ChatDB } from "../chatdb.js";
import type { ChatDBConfig } from "../types.js";
import { printTable } from "./output.js";

export async function startRepl(config: ChatDBConfig): Promise<void> {
  const db = new ChatDB(config);

  // Test connection by fetching tables
  try {
    const tables = await db.listTables();
    console.log(`\n  Connected. Found ${tables.length} tables.`);
    console.log("  Type your question, or .help for commands.\n");
  } catch (err: any) {
    console.error(`\n  Connection error: ${err.message}\n`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "chatdb> ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Dot-commands
    if (input === ".help") {
      console.log(`
  .tables   List tables in the database
  .schema   Show the database schema
  .clear    Clear conversation history
  .exit     Exit the REPL
`);
      rl.prompt();
      return;
    }

    if (input === ".tables") {
      try {
        const tables = await db.listTables();
        console.log(`\n  ${tables.join("\n  ")}\n`);
      } catch (err: any) {
        console.error(`  Error: ${err.message}\n`);
      }
      rl.prompt();
      return;
    }

    if (input === ".schema") {
      try {
        const schema = await db.getSchema();
        console.log(`\n${schema}\n`);
      } catch (err: any) {
        console.error(`  Error: ${err.message}\n`);
      }
      rl.prompt();
      return;
    }

    if (input === ".clear") {
      db.clearHistory();
      console.log("  History cleared.\n");
      rl.prompt();
      return;
    }

    if (input === ".exit" || input === ".quit") {
      await db.close();
      process.exit(0);
    }

    // Natural language query
    try {
      const startTime = Date.now();
      const result = await db.ask(input);
      const duration = Date.now() - startTime;

      console.log(`\n  SQL: ${result.sql}`);
      console.log(`\n  ${result.explanation}\n`);
      printTable(result);
      console.log(`  ${result.rowCount} rows | ${result.chartType} | ${duration}ms\n`);
    } catch (err: any) {
      console.error(`  Error: ${err.message}\n`);
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await db.close();
    process.exit(0);
  });
}

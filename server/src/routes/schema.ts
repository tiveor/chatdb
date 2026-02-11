import { Hono } from "hono";
import type { ChatDB } from "@tiveor/chatdb";

export function createSchemaRoutes(chatdb: ChatDB) {
  const schema = new Hono();

  schema.get("/list", async (c) => {
    const schemas = await chatdb.listSchemas();
    return c.json({ schemas });
  });

  schema.get("/tables", async (c) => {
    const name = c.req.query("name") || "public";
    const tables = await chatdb.listTables(name);
    return c.json({ tables });
  });

  schema.get("/", async (c) => {
    const name = c.req.query("name") || "public";
    const schemaText = await chatdb.getSchema(name);
    return c.json({ schema: schemaText });
  });

  schema.post("/refresh", async (c) => {
    chatdb.refreshSchema();
    return c.json({ refreshed: true });
  });

  return schema;
}

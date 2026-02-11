import { Hono } from "hono";
import { getSchemaText, invalidateSchemaCache, listSchemas, listTables } from "../services/schema.js";

const schema = new Hono();

schema.get("/list", async (c) => {
  const schemas = await listSchemas();
  return c.json({ schemas });
});

schema.get("/tables", async (c) => {
  const name = c.req.query("name") || "public";
  const tables = await listTables(name);
  return c.json({ tables });
});

schema.get("/", async (c) => {
  const name = c.req.query("name") || "public";
  const schemaText = await getSchemaText(name);
  return c.json({ schema: schemaText });
});

schema.post("/refresh", async (c) => {
  invalidateSchemaCache();
  return c.json({ refreshed: true });
});

export default schema;

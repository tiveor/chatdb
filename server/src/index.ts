import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Dynamic imports so env vars are loaded before modules read them
const { serve } = await import("@hono/node-server");
const { Hono } = await import("hono");
const { cors } = await import("hono/cors");
const { ChatDB } = await import("@tiveor/chatdb");
const { createChatRoutes } = await import("./routes/chat.js");
const { createSchemaRoutes } = await import("./routes/schema.js");

const chatdb = new ChatDB({
  database: process.env.DATABASE_URL!,
  llm: {
    url: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL,
  },
  debug: true,
});

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "POST"],
  })
);

app.route("/api/chat", createChatRoutes(chatdb));
app.route("/api/schema", createSchemaRoutes(chatdb));

app.get("/api/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT) || 3001;

console.log(`ChatDB server running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });

import { useState, useEffect } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { ChatInput } from "./components/ChatInput";
import { LogPanel } from "./components/LogPanel";
import { useChat } from "./hooks/useChat";
import { fetchSchemas, fetchTables } from "./services/api";

export default function App() {
  const { messages, logs, isLoading, send, clear, clearLogs } = useChat();
  const [schemas, setSchemas] = useState<string[]>([]);
  const [schema, setSchema] = useState("public");
  const [tables, setTables] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    fetchSchemas().then((list) => {
      setSchemas(list);
      if (list.length > 0 && !list.includes("public")) {
        setSchema(list[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (schema) {
      fetchTables(schema).then(setTables);
    }
  }, [schema]);

  function handleSend(text: string) {
    send(text, schema);
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-gray-800">ChatDB</span>
              <select
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-600 focus:outline-none focus:border-blue-400"
              >
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  New conversation
                </button>
              )}
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  showLogs
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Logs
              </button>
            </div>
          </div>
          {tables.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tables.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Chat */}
        <ChatWindow messages={messages} onNewConversation={clear} onSend={handleSend} />

        {/* Input */}
        <div className="mx-auto w-full max-w-3xl">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>

      {/* Log panel */}
      {showLogs && (
        <LogPanel
          logs={logs}
          onClear={clearLogs}
          onClose={() => setShowLogs(false)}
        />
      )}
    </div>
  );
}

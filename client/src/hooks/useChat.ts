import { useState, useCallback } from "react";
import type { ChatMessage, LogEntry } from "../types";
import { sendMessage } from "../services/api";

let idCounter = 0;
function genId() {
  return `msg-${++idCounter}-${Date.now()}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = useCallback((message: string, lines: string[], isError = false) => {
    setLogs((prev) => [
      ...prev,
      { id: genId(), timestamp: new Date(), message, lines, isError },
    ]);
  }, []);

  const send = useCallback(
    async (text: string, schemaName: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: text,
      };

      const loadingMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "",
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, loadingMsg]);
      setIsLoading(true);
      addLog(`Query: "${text}"`, [`Schema: ${schemaName}`]);

      try {
        const response = await sendMessage(text, [...messages, userMsg], schemaName);

        const assistantMsg: ChatMessage = {
          id: loadingMsg.id,
          role: "assistant",
          content: response.text,
          data: response.data ?? undefined,
          contextOverflow: response.contextOverflow,
        };

        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsg.id ? assistantMsg : m))
        );

        if (response.logs) {
          addLog(`Response: "${text}"`, response.logs, !!response.contextOverflow);
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : "Unknown error";
        const errorMsg: ChatMessage = {
          id: loadingMsg.id,
          role: "assistant",
          content: `Error: ${errorText}`,
        };
        setMessages((prev) =>
          prev.map((m) => (m.id === loadingMsg.id ? errorMsg : m))
        );
        addLog(`Error: "${text}"`, [errorText], true);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, addLog]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setLogs([]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { messages, logs, isLoading, send, clear, clearLogs };
}

import { useEffect, useRef } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  onNewConversation: () => void;
  onSend: (text: string) => void;
}

const SUGGESTIONS = [
  { text: "Total sales by month", icon: "📈" },
  { text: "Top 10 best-selling products", icon: "🏆" },
  { text: "Order distribution by status", icon: "🥧" },
  { text: "Total revenue last month", icon: "💰" },
  { text: "Sales by product category", icon: "📊" },
  { text: "Last 10 orders placed", icon: "📋" },
];

export function ChatWindow({ messages, onNewConversation, onSend }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700">ChatDB</h2>
          <p className="mt-2 text-gray-400">
            Ask your database anything in natural language.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 max-w-lg mx-auto">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                onClick={() => onSend(s.text)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
              >
                <span>{s.icon}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onNewConversation={onNewConversation} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

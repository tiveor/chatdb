import { useState } from "react";
import type { ChatMessage } from "../types";
import { DataTable } from "./DataTable";
import { ChartRenderer } from "./ChartRenderer";
import { ExportButton } from "./ExportButton";

interface Props {
  message: ChatMessage;
  onNewConversation?: () => void;
}

export function MessageBubble({ message, onNewConversation }: Props) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";

  if (message.loading) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400 [animation-delay:0.2s]" />
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400 [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl bg-gray-100 px-4 py-3">
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>

        {message.contextOverflow && onNewConversation && (
          <button
            onClick={onNewConversation}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Start new conversation
          </button>
        )}

        {message.data && (
          <>
            <ChartRenderer data={message.data} />

            {message.data.chartType !== "number" && (
              <DataTable
                columns={message.data.columns}
                rows={message.data.rows}
                rowCount={message.data.rowCount}
              />
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setShowSql(!showSql)}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              >
                {showSql ? "Hide SQL" : "Show SQL"}
              </button>
              <ExportButton data={message.data} />
            </div>

            {showSql && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-800 p-3 text-xs text-green-400">
                {message.data.sql}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

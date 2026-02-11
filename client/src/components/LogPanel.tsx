import { useEffect, useRef } from "react";
import type { LogEntry } from "../types";

interface Props {
  logs: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}

export function LogPanel({ logs, onClear, onClose }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-200 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
        <span className="text-xs font-medium text-gray-300">Logs</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {logs.length === 0 && (
          <p className="text-xs text-gray-600 italic">No logs yet. Send a message to see debug info.</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${log.isError ? "bg-red-400" : "bg-green-400"}`} />
              <span className="text-xs text-gray-400">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className={`text-xs font-medium ${log.isError ? "text-red-400" : "text-gray-200"}`}>
              {log.message}
            </p>
            {log.lines.map((line, i) => {
              const isSQL = line.startsWith("Generated SQL:");
              const isError = line.startsWith("ERROR:") || line.startsWith("BLOCKED:");
              return (
                <p
                  key={i}
                  className={`text-xs font-mono pl-3 ${
                    isSQL
                      ? "text-blue-400"
                      : isError
                        ? "text-red-400"
                        : "text-gray-500"
                  }`}
                >
                  {line}
                </p>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

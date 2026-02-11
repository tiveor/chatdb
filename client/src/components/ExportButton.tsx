import type { QueryResult } from "../types";

interface Props {
  data: QueryResult;
}

export function ExportButton({ data }: Props) {
  function exportCSV() {
    const { columns, rows } = data;
    const header = columns.join(",");
    const body = rows
      .map((row) =>
        columns
          .map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      )
      .join("\n");

    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chatdb-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(data.rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chatdb-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-2 flex gap-2">
      <button
        onClick={exportCSV}
        className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        Export CSV
      </button>
      <button
        onClick={exportJSON}
        className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        Export JSON
      </button>
    </div>
  );
}

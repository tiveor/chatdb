interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function DataTable({ columns, rows, rowCount }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 italic">No results found.</p>;
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-gray-600 border-b border-gray-200"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
              >
                {columns.map((col) => (
                  <td key={col} className="px-4 py-2 text-gray-700 border-b border-gray-100">
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {rowCount} row{rowCount !== 1 ? "s" : ""} returned
      </p>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

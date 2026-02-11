import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { QueryResult } from "../types";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface Props {
  data: QueryResult;
}

export function ChartRenderer({ data }: Props) {
  const { chartType, columns, rows } = data;

  if (rows.length === 0) return null;

  // For "number" type, show a big stat
  if (chartType === "number" && rows.length === 1) {
    const value = Object.values(rows[0])[0];
    return (
      <div className="my-4 flex items-center justify-center">
        <div className="rounded-2xl bg-blue-50 px-8 py-6 text-center">
          <p className="text-4xl font-bold text-blue-700">
            {typeof value === "number" ? value.toLocaleString() : String(value)}
          </p>
          <p className="mt-1 text-sm text-blue-500">{columns[0]}</p>
        </div>
      </div>
    );
  }

  if (chartType === "table") return null; // DataTable handles this

  // Determine axes: first column = category/x, rest = numeric values
  // PostgreSQL returns numeric/bigint as strings, so check both types
  const isNumeric = (v: unknown) => typeof v === "number" || (typeof v === "string" && v !== "" && !isNaN(Number(v)));
  const xKey = columns[0];
  const valueKeys = columns.slice(1).filter((col) =>
    rows.some((r) => isNumeric(r[col]))
  );

  if (valueKeys.length === 0) return null;

  const chartData = rows.map((row) => {
    const item: Record<string, unknown> = { [xKey]: String(row[xKey]) };
    for (const key of valueKeys) {
      item[key] = Number(row[key]) || 0;
    }
    return item;
  });

  return (
    <div className="my-4 h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "bar" ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : chartType === "line" ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {valueKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={chartData}
              dataKey={valueKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

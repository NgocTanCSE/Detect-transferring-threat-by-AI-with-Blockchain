"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Alert } from "@/lib/api";
import type { AlertsSummary } from "../dashboard-utils";
import {
  ROLE_COLORS,
  countBy,
} from "../dashboard-utils";

export default function AlertChartPanel({ alerts, alertsSummary }: { alerts: Alert[]; alertsSummary: AlertsSummary | null }) {
  const severityCounts = countBy(alerts, (entry) => entry.severity);
  const chartData = [
    { name: "CRITICAL", value: alertsSummary?.critical ?? severityCounts.CRITICAL ?? 0 },
    { name: "HIGH", value: alertsSummary?.high ?? severityCounts.HIGH ?? 0 },
    { name: "MEDIUM", value: alertsSummary?.medium ?? severityCounts.MEDIUM ?? 0 },
    { name: "LOW", value: alertsSummary?.low ?? severityCounts.LOW ?? 0 },
  ];

  return (
    <div className="h-[320px] rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
          <Bar dataKey="value" radius={[10, 10, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={ROLE_COLORS.security_analyst[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

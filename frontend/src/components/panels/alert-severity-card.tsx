"use client";

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { countBy, ROLE_COLORS } from "../dashboard-utils";
import type { AlertsSummary } from "../dashboard-utils";
import type { Alert } from "@/lib/api";

function AlertSeverityCard({ alertsSummary, alerts }: { alertsSummary: AlertsSummary | null; alerts: Alert[] }) {
  const derivedCounts = countBy(alerts, (entry) => entry.severity);
  const counts = {
    CRITICAL: alertsSummary?.critical ?? derivedCounts.CRITICAL ?? 0,
    HIGH: alertsSummary?.high ?? derivedCounts.HIGH ?? 0,
    MEDIUM: alertsSummary?.medium ?? derivedCounts.MEDIUM ?? 0,
    LOW: alertsSummary?.low ?? derivedCounts.LOW ?? 0,
  };

  const chartData = [
    { name: "CRITICAL", value: counts.CRITICAL },
    { name: "HIGH", value: counts.HIGH },
    { name: "MEDIUM", value: counts.MEDIUM },
    { name: "LOW", value: counts.LOW },
  ];

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <p className="text-sm font-semibold text-white">Severity mix</p>
      <div className="mt-3 h-[260px]">
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
    </div>
  );
}

export default AlertSeverityCard;

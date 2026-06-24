"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CaseSummary } from "../dashboard-utils";
import {
  ROLE_COLORS,
  MetricBlock,
  formatCompact,
} from "../dashboard-utils";

export default function CaseActionPanel({ caseSummary }: { caseSummary: CaseSummary | null }) {
  const totals = caseSummary?.totals ?? {};
  const chartData = [
    { name: "PENDING", value: totals.PENDING ?? 0 },
    { name: "VERIFIED", value: totals.VERIFIED ?? 0 },
    { name: "FRAUD", value: totals.FRAUD ?? 0 },
    { name: "ignored", value: totals.ignored ?? 0 },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={ROLE_COLORS.security_analyst[index]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3">
        <MetricBlock label="High-risk unassigned" value={formatCompact(caseSummary?.high_risk_unassigned ?? 0)} helper="Needs immediate action" tone="amber" />
        <MetricBlock label="Total queue" value={formatCompact(Object.values(totals).reduce((sum, value) => sum + value, 0))} helper="Live case volume" tone="teal" />
        <MetricBlock label="Assignment pressure" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Open cases without owners" tone="amber" />
      </div>
    </div>
  );
}

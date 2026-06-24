"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { MetricBlock, formatCompact, ROLE_COLORS } from "../dashboard-utils";
import type { FeatureConfigItem } from "../dashboard-utils";

function FeatureOperationsPanel({ features }: { features: FeatureConfigItem[] }) {
  const enabled = features.filter((item) => item.enabled).length;
  const data = [
    { name: "Enabled", value: enabled },
    { name: "Disabled", value: Math.max(0, features.length - enabled) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={index === 0 ? ROLE_COLORS.ai_data_engineer[0] : ROLE_COLORS.ai_data_engineer[2]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <div className="space-y-3">
          <MetricBlock label="Enabled features" value={formatCompact(enabled)} helper="Active feature flags" tone="teal" />
          <MetricBlock label="Disabled features" value={formatCompact(Math.max(0, features.length - enabled))} helper="Risk-free toggles" tone="slate" />
          <MetricBlock label="Owner coverage" value={formatCompact(new Set(features.map((item) => item.owner_user_id).filter(Boolean)).size)} helper="Unique owners" tone="slate" />
        </div>
      </div>
    </div>
  );
}

export default FeatureOperationsPanel;

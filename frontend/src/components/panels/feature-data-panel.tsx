"use client";

import { EmptyState, MetricBlock, formatCompact, formatDateTime } from "../dashboard-utils";
import type { FeatureConfigItem } from "../dashboard-utils";

function FeatureDataPanel({ features }: { features: FeatureConfigItem[] }) {
  if (!features.length) {
    return <EmptyState message="No feature data available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Features" value={formatCompact(features.length)} helper="All records" tone="teal" />
        <MetricBlock label="With expression" value={formatCompact(features.filter((item) => Boolean(item.expression)).length)} helper="Ready for runtime" tone="teal" />
        <MetricBlock label="Owned" value={formatCompact(features.filter((item) => Boolean(item.owner_user_id)).length)} helper="Has owner" tone="slate" />
        <MetricBlock label="Updated" value={formatCompact(features.filter((item) => Boolean(item.updated_at)).length)} helper="Fresh metadata" tone="slate" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Feature key</th>
              <th className="px-4 py-3 text-left font-medium">Expression</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {features.slice(0, 50).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.feature_key}</td>
                <td className="px-4 py-3">{item.expression ?? "-"}</td>
                <td className="px-4 py-3">{item.owner_user_id ?? "-"}</td>
                <td className="px-4 py-3">{formatDateTime(item.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FeatureDataPanel;

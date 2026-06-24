"use client";

import { MetricBlock, formatCompact, formatDateTime } from "../dashboard-utils";
import type { ModelRegistryItem } from "../dashboard-utils";

function ModelOperationsPanel({ models, activeModels }: { models: ModelRegistryItem[]; activeModels: ModelRegistryItem[] }) {
  const activeKey = new Set(activeModels.map((item) => `${item.model_name}:${item.version}`));
  const promoted = models.filter((item) => Boolean(item.promoted_at));
  const inactive = models.filter((item) => !item.is_active && !activeKey.has(`${item.model_name}:${item.version}`));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Active serving" value={formatCompact(activeModels.length)} helper="Live models" tone="teal" />
        <MetricBlock label="Promoted" value={formatCompact(promoted.length)} helper="Governed promotions" tone="teal" />
        <MetricBlock label="Inactive" value={formatCompact(inactive.length)} helper="Needs review" tone="amber" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(models.map((item) => item.framework)).size)} helper="Runtime diversity" tone="slate" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Promoted</th>
              <th className="px-4 py-3 text-left font-medium">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {models.slice(0, 50).map((item) => {
              const key = `${item.model_name}:${item.version}`;
              const isServing = item.is_active || activeKey.has(key);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.model_name}</td>
                  <td className="px-4 py-3">{item.version}</td>
                  <td className="px-4 py-3">{isServing ? "SERVING" : "INACTIVE"}</td>
                  <td className="px-4 py-3">{formatDateTime(item.promoted_at)}</td>
                  <td className="px-4 py-3">{item.promoted_by ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ModelOperationsPanel;

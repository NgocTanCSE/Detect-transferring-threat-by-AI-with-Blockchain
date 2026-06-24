"use client";

import { EmptyState, MetricBlock, formatCompact, formatDateTime } from "../dashboard-utils";
import type { ModelRegistryItem } from "../dashboard-utils";

function RegistryDataPanel({ models }: { models: ModelRegistryItem[] }) {
  if (!models.length) {
    return <EmptyState message="No registry versions available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Versions" value={formatCompact(models.length)} helper="Tracked versions" tone="teal" />
        <MetricBlock label="Artifacts" value={formatCompact(models.filter((item) => Boolean(item.artifact_uri)).length)} helper="Stored URIs" tone="teal" />
        <MetricBlock label="Promoted" value={formatCompact(models.filter((item) => Boolean(item.promoted_at)).length)} helper="Lifecycle events" tone="slate" />
        <MetricBlock label="Missing promoter" value={formatCompact(models.filter((item) => !item.promoted_by).length)} helper="Governance gap" tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Artifact URI</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {models.slice(0, 50).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.model_name}</td>
                <td className="px-4 py-3">{item.version}</td>
                <td className="px-4 py-3">{item.artifact_uri || "-"}</td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RegistryDataPanel;

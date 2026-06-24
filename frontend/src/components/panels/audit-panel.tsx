"use client";

import type { AuditCompleteness, AuditGaps } from "../dashboard-utils";
import {
  EmptyState,
  MetricBlock,
  formatCompact,
  formatPercent,
} from "../dashboard-utils";

export default function AuditPanel({ auditCompleteness, auditGaps }: { auditCompleteness: AuditCompleteness | null; auditGaps: AuditGaps | null }) {
  if (!auditCompleteness && !auditGaps) {
    return <EmptyState message="Audit data is not available from the backend right now." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <MetricBlock label="Completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="required audit actions present" tone="teal" />
        <MetricBlock label="Present actions" value={auditCompleteness ? `${auditCompleteness.present_actions}/${auditCompleteness.required_actions}` : "-"} helper="Audit coverage" tone="teal" />
        <MetricBlock label="Missing actions" value={auditGaps ? formatCompact(auditGaps.missing_count) : "-"} helper="Gaps needing evidence" tone="teal" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Count</th>
              <th className="px-4 py-3 text-left font-medium">Present</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {auditCompleteness?.checks.slice(0, 8).map((check) => (
              <tr key={check.action_type}>
                <td className="px-4 py-3">{check.action_type}</td>
                <td className="px-4 py-3">{check.count}</td>
                <td className="px-4 py-3">{check.present ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

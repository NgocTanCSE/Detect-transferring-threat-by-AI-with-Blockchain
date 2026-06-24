"use client";

import type { ControlEffectiveness, ReportingSummary } from "../dashboard-utils";
import {
  EmptyState,
  MetricBlock,
  formatCompact,
  formatEth,
  formatPercent,
} from "../dashboard-utils";

export default function ControlEffectivenessPanel({ controlEffectiveness, reportingSummary }: { controlEffectiveness: ControlEffectiveness | null; reportingSummary: ReportingSummary | null }) {
  if (!controlEffectiveness) {
    return <EmptyState message="Control effectiveness metrics are unavailable." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricBlock label="Block rate" value={formatPercent(controlEffectiveness.metrics.block_rate_pct)} helper="Actionable alerts blocked" tone="teal" />
        <MetricBlock label="Fraud precision" value={formatPercent(controlEffectiveness.metrics.fraud_precision_proxy_pct)} helper="Decision quality proxy" tone="teal" />
        <MetricBlock label="Decision coverage" value={formatCompact(controlEffectiveness.metrics.decision_coverage)} helper="Resolved cases" tone="teal" />
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold text-white">Reporting summary</p>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p>Alerts: {formatCompact(reportingSummary?.kpis?.alerts_total ?? 0)}</p>
          <p>Blocked value: {reportingSummary ? formatEth(reportingSummary.kpis?.blocked_value_eth ?? 0) : "-"}</p>
          <p>Notifications failed: {formatCompact(reportingSummary?.kpis?.notifications_failed ?? 0)}</p>
          <p>Window days: {reportingSummary?.period?.days ?? controlEffectiveness.period_days}</p>
        </div>
      </div>
    </div>
  );
}

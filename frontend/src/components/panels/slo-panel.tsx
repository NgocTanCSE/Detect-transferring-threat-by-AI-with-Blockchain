"use client";

import { EmptyState, MetricBlock, formatPercent } from "../dashboard-utils";
import type { SloMetrics } from "../dashboard-utils";

function SloPanel({ sloMetrics }: { sloMetrics: SloMetrics | null }) {
  if (!sloMetrics) {
    return <EmptyState message="SLO metrics are not available from the backend right now." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricBlock label="Availability" value={formatPercent(sloMetrics.endpoint_health.availability_pct)} helper={`${sloMetrics.endpoint_health.healthy_active}/${sloMetrics.endpoint_health.active} active endpoints healthy`} tone="teal" />
      <MetricBlock label="Error budget burn" value={formatPercent(sloMetrics.endpoint_health.error_budget_burn_pct)} helper="Current window" tone="teal" />
      <MetricBlock label="Ingest p95" value={`${sloMetrics.latency_slo.ingest_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.ingest_target_ms.toFixed(0)} ms`} tone="teal" />
      <MetricBlock label="Decode p95" value={`${sloMetrics.latency_slo.decode_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.decode_target_ms.toFixed(0)} ms`} tone="teal" />
    </div>
  );
}

export default SloPanel;

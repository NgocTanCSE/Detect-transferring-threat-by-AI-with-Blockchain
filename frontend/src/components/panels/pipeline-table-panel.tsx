"use client";

import { PipelineMetricItem, MetricCard, formatCompact } from "../dashboard-utils";

function PipelineTable({ metrics, summary }: { metrics: PipelineMetricItem[]; summary: { total_points: number; avg_throughput_tps: number | null; avg_ingestion_latency_ms: number | null; avg_decode_latency_ms: number | null; last_block_number: number | null } | null }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Points" value={summary ? formatCompact(summary.total_points) : "-"} hint="Pipeline samples" accentClass="border-slate-800 bg-slate-900/70" />
        <MetricCard label="Avg TPS" value={summary?.avg_throughput_tps != null ? summary.avg_throughput_tps.toFixed(1) : "-"} hint="Throughput" accentClass="border-teal-400/20 bg-teal-500/10" />
        <MetricCard label="Ingest latency" value={summary?.avg_ingestion_latency_ms != null ? `${summary.avg_ingestion_latency_ms.toFixed(0)} ms` : "-"} hint="Average" accentClass="border-amber-400/20 bg-amber-500/10" />
        <MetricCard label="Last block" value={summary?.last_block_number != null ? formatCompact(summary.last_block_number) : "-"} hint="Latest signal" accentClass="border-slate-500/20 bg-slate-500/10" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Chain</th>
              <th className="px-4 py-3 text-left font-medium">Block</th>
              <th className="px-4 py-3 text-left font-medium">TPS</th>
              <th className="px-4 py-3 text-left font-medium">Ingest</th>
              <th className="px-4 py-3 text-left font-medium">Decode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {metrics.slice(0, 8).map((metric, i) => (
              <tr key={metric.id} className="animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="px-4 py-3">{metric.chain}</td>
                <td className="px-4 py-3">{metric.block_number ?? "-"}</td>
                <td className="px-4 py-3">{metric.throughput_tps != null ? metric.throughput_tps.toFixed(1) : "-"}</td>
                <td className="px-4 py-3">{metric.ingestion_latency_ms ?? "-"}</td>
                <td className="px-4 py-3">{metric.decode_latency_ms ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PipelineTable;

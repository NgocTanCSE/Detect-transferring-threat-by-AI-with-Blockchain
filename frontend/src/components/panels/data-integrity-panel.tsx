"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Download, RefreshCcw } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { EmptyState, MetricBlock, formatCompact, integrityRouteForKey } from "../dashboard-utils";
import type { DataIntegrityReport } from "../dashboard-utils";

function DataIntegrityPanel({ report, onRefresh }: { report: DataIntegrityReport | null; onRefresh?: () => void }) {
  const [isFixing, setIsFixing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [seedStatus, setSeedStatus] = useState<any>(null);

  useEffect(() => {
    const fetchSeedStatus = async () => {
      try {
        const res = await authFetch("/api/admin/diagnostics/seed-data");
        if (res.ok) setSeedStatus(await res.json());
      } catch (e) {
        console.error("Failed to fetch seed status:", e);
      }
    };
    fetchSeedStatus();
  }, [report]);

  if (!report) {
    return <EmptyState message="Data integrity report is not available yet." />;
  }

  const missing = report.missing_controls ?? [];

  async function handleAutoFix() {
    setIsFixing(true);
    try {
      const response = await authFetch("/api/ops/system/data-integrity/auto-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      if (!response.ok) throw new Error("Failed to auto-fix integrity controls");
      if (onRefresh) onRefresh();
    } finally {
      setIsFixing(false);
    }
  }

  async function handleExportIntegrity(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const response = await authFetch(`/api/ops/system/data-integrity/export?format=${format}`);
      if (!response.ok) throw new Error("Failed to export integrity report");
      const payload = await response.json();
      const data = payload?.data ?? payload;

      if (format === "csv") {
        const csvText = String(data?.csv || "");
        const fileName = String(data?.filename || "data_integrity.csv");
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const jsonText = JSON.stringify(data?.report ?? {}, null, 2);
      const fileName = String(data?.filename || "data_integrity.json");
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Data integrity controls</p>
          <p className="mt-1 text-xs text-slate-400">DB-first readiness for role modules and controls</p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${report.overall_ok ? "border-teal-400/40 bg-teal-400/10 text-teal-50" : "border-amber-400/40 bg-amber-400/10 text-amber-50"}`}>
          {report.overall_ok ? "ALL OK" : `${missing.length} GAPS`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricBlock label="Checks" value={formatCompact(report.checks.length)} helper="Total controls" tone="teal" />
        <MetricBlock label="Missing" value={formatCompact(missing.length)} helper="Need seeding/config" tone={missing.length ? "amber" : "slate"} />
        <MetricBlock label="Roles ready" value={formatCompact(Object.values(report.role_readiness || {}).filter(Boolean).length)} helper="Out of 4 roles" tone="teal" />
        <MetricBlock label="Diagnostics rows" value={formatCompact(report.counts?.diagnostic_events ?? 0)} helper="Persistent logs" tone="slate" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAutoFix()}
          disabled={isFixing || missing.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-50 transition hover:border-teal-300/60 disabled:opacity-60"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {isFixing ? "Auto-fixing..." : `Auto-fix missing (${missing.length})`}
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("csv")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-teal-400/50 hover:text-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export integrity CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("json")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:text-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export integrity JSON
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Control</th>
              <th className="px-4 py-3 text-left font-medium">Owner role</th>
              <th className="px-4 py-3 text-left font-medium">Actual / required</th>
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {(missing.length ? missing : report.checks.slice(0, 8).map((item) => ({
              key: item.key,
              owner_role: item.owner_role,
              actual: item.actual,
              required_min: item.required_min,
              severity: item.ok ? "ok" : "medium",
            }))
            ).slice(0, 10).map((item) => (
              <tr key={`${item.key}:${item.owner_role}`}>
                <td className="px-4 py-3">{item.key}</td>
                <td className="px-4 py-3">{item.owner_role}</td>
                <td className="px-4 py-3">{item.actual} / {item.required_min}</td>
                <td className="px-4 py-3">{String(item.severity).toUpperCase()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={integrityRouteForKey(item.key, item.owner_role)}
                    prefetch={false}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white hover:border-white/40"
                  >
                    Open owner view
                  </Link>
                </td>
              </tr>
            ))}
            {missing.length === 0 && report.checks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No integrity controls were returned.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataIntegrityPanel;

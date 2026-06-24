"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { AuditCompleteness, ControlEffectiveness, ReportingSummary } from "../dashboard-utils";
import {
  ROLE_COLORS,
  EmptyState,
  MetricBlock,
  formatCompact,
  formatEth,
  formatPercent,
} from "../dashboard-utils";

export default function ReportingSummaryPanel({ reportingSummary, controlEffectiveness, auditCompleteness }: { reportingSummary: ReportingSummary | null; controlEffectiveness: ControlEffectiveness | null; auditCompleteness: AuditCompleteness | null }) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/ops/compliance/reporting/export`);
      if (!response.ok) throw new Error("Failed to export report");
      
      const data = await response.json();
      const csvContent = data.rows.map((r: any) => `${r.metric},${r.value}`).join("\n");
      const blob = new Blob(["metric,value\n" + csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "compliance_report.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }

  const chartData = reportingSummary ? [
    { name: "Alerts", value: reportingSummary.kpis?.alerts_total ?? 0 },
    { name: "Blocked", value: reportingSummary.kpis?.blocked_total ?? 0 },
    { name: "Policies", value: reportingSummary.kpis?.policy_rules_active ?? 0 },
    { name: "Audit", value: reportingSummary.kpis?.audit_events ?? 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="border-slate-800 bg-slate-900/50 hover:bg-slate-800"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export Compliance Report (CSV)
        </Button>
      </div>

      {!reportingSummary ? (
        <EmptyState message="Reporting summary is loading or not available yet..." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill={ROLE_COLORS.compliance_risk_manager[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-3">
            <MetricBlock label="Audit completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="Evidence coverage" tone="teal" />
            <MetricBlock label="Block rate" value={controlEffectiveness ? formatPercent(controlEffectiveness.metrics?.block_rate_pct ?? 0) : "-"} helper="Compliance outcomes" tone="teal" />
            <MetricBlock label="Blocked value" value={formatEth(reportingSummary?.kpis?.blocked_value_eth ?? 0)} helper="Live risk impact" tone="teal" />
          </div>
        </div>
      )}
    </div>
  );
}

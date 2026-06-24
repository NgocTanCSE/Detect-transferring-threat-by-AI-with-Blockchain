"use client";

import { useState, useEffect } from "react";
import { formatCompact, MetricBlock } from "../dashboard-utils";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";
import { Search, Download, Archive } from "lucide-react";

function DiagnosticsLogsPanel({
  logs,
}: {
  logs: Array<{ id?: string; timestamp: string; log_type: string; message: string; status_code?: number; endpoint?: string; details?: Record<string, unknown> }>;
}) {
  const [mutableLogs, setMutableLogs] = useState(logs);
  const [searchFilter, setSearchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [exportDate, setExportDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    setMutableLogs(logs);
  }, [logs]);

  async function reloadLogs(archived: boolean) {
    setIsReloading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (archived) params.set("include_archived", "true");
      const response = await authFetch(`/api/admin/diagnostics/logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to reload diagnostics logs");
      const payload = await response.json();
      const data = payload?.data ?? payload;
      setMutableLogs(Array.isArray(data?.logs) ? data.logs : []);
    } finally {
      setIsReloading(false);
    }
  }

  useEffect(() => {
    if (!includeArchived) return;
    void reloadLogs(true);
  }, [includeArchived]);

  const logTypeColors: Record<string, string> = {
    error: "bg-amber-500/20 text-amber-200 border-amber-500/30",
    info: "bg-teal-500/20 text-teal-100 border-teal-500/30",
    api_call: "bg-slate-500/20 text-slate-200 border-slate-500/30",
    api_error: "bg-amber-500/20 text-amber-200 border-amber-500/30",
    ai_service: "bg-slate-500/20 text-slate-200 border-slate-500/30",
    success: "bg-teal-500/20 text-teal-100 border-teal-500/30",
    warning: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  };

  const filteredLogs = mutableLogs.filter((log) => {
    const matchesSearch =
      searchFilter === "" ||
      log.message.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (log.endpoint || "").toLowerCase().includes(searchFilter.toLowerCase());
    const matchesType = typeFilter === "all" || log.log_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const uniqueTypes = Array.from(new Set(mutableLogs.map((log) => log.log_type))).sort();
  const errorCount = mutableLogs.filter((log) => {
    const kind = (log.log_type || "").toLowerCase();
    return kind === "error" || kind === "api_error" || (log.status_code ?? 200) >= 400;
  }).length;
  const statusCodes = Array.from(new Set(mutableLogs.map((log) => log.status_code).filter(Boolean))) as number[];

  async function handleExport() {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (exportDate) params.set("date", exportDate);
      const response = await authFetch(`/api/admin/diagnostics/logs/export?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to export diagnostics logs");
      const payload = await response.json();
      const data = payload?.data ?? payload;
      const csv = String(data?.csv || "");
      const filename = String(data?.filename || "diagnostics_logs.csv");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleArchivefiltered(archived: boolean) {
    setIsArchiving(true);
    try {
      const response = await authFetch("/api/admin/diagnostics/logs/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived,
          log_type: typeFilter === "all" ? null : typeFilter,
          search: searchFilter.trim() || null,
          include_archived: true,
          max_rows: 1000,
        }),
      });
      if (!response.ok) throw new Error("Failed to update archive for filtered logs");
      const payload = await response.json();
      const data = payload?.data ?? payload;
      const archivedIds = new Set<string>(Array.isArray(data?.archived_ids) ? data.archived_ids : []);
      if (archivedIds.size) {
        if (archived) {
          setMutableLogs((prev) => prev.filter((item) => !item.id || !archivedIds.has(item.id)));
        } else {
          await reloadLogs(includeArchived);
        }
      }
    } finally {
      setIsArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Total logs" value={formatCompact(mutableLogs.length)} helper="All diagnostic entries" tone="slate" />
        <MetricBlock label="Errors" value={formatCompact(errorCount)} helper="Error logs" tone={errorCount > 0 ? "red" : "slate"} />
        <MetricBlock label="Endpoints" value={formatCompact(new Set(mutableLogs.map((log) => log.endpoint).filter(Boolean)).size)} helper="Unique endpoints" tone="blue" />
        <MetricBlock label="Log types" value={formatCompact(uniqueTypes.length)} helper="Different log categories" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={exportDate}
          onChange={(event) => setExportDate(event.target.value)}
          className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        />
        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-teal-400/50 hover:text-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchivefiltered(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-50 transition hover:border-teal-300/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Archiving..." : `Archive filtered (${filteredLogs.length})`}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchivefiltered(false)}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-50 transition hover:border-amber-300/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Updating..." : "Unarchive filtered"}
        </button>
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => {
              const checked = event.target.checked;
              setIncludeArchived(checked);
              if (!checked) setMutableLogs(logs);
            }}
            className="h-3.5 w-3.5"
          />
          Include archived
        </label>
        {isReloading ? <span className="text-xs text-slate-500">Reloading logs...</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search message or endpoint..."
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-teal-400/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        >
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Message</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Endpoint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {filteredLogs.slice(0, 50).map((log, idx) => (
              <tr key={idx} className="hover:bg-slate-900/30">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-lg border px-2 py-1 text-xs font-medium ${logTypeColors[(log.log_type || "").toLowerCase()] || "bg-slate-700/50 text-slate-200"}`}>
                    {(log.log_type || "unknown").toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-sm truncate text-slate-300">{log.message}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {log.status_code ? (
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${log.status_code >= 200 && log.status_code < 300
                        ? "bg-teal-500/20 text-teal-100"
                        : log.status_code >= 400
                          ? "bg-amber-500/20 text-amber-100"
                          : "bg-slate-700/20 text-slate-300"
                        }`}
                    >
                      {log.status_code}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 max-w-xs truncate text-xs text-slate-400">{log.endpoint || "-"}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No logs match current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        Showing {Math.min(50, filteredLogs.length)} of {filteredLogs.length} logs • Total in system: {mutableLogs.length}
      </div>
    </div>
  );
}

export default DiagnosticsLogsPanel;

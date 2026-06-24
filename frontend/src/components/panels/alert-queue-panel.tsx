"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Alert } from "@/lib/api";
import type { AlertsSummary } from "../dashboard-utils";
import {
  ROLE_COLORS,
  TablePager,
  formatAddress,
  formatDateTime,
  SeverityPill,
  countBy,
} from "../dashboard-utils";

function AlertSeverityCard({ alertsSummary, alerts }: { alertsSummary: AlertsSummary | null; alerts: Alert[] }) {
  const derivedCounts = countBy(alerts, (entry) => entry.severity);
  const counts = {
    CRITICAL: alertsSummary?.critical ?? derivedCounts.CRITICAL ?? 0,
    HIGH: alertsSummary?.high ?? derivedCounts.HIGH ?? 0,
    MEDIUM: alertsSummary?.medium ?? derivedCounts.MEDIUM ?? 0,
    LOW: alertsSummary?.low ?? derivedCounts.LOW ?? 0,
  };

  const chartData = [
    { name: "CRITICAL", value: counts.CRITICAL },
    { name: "HIGH", value: counts.HIGH },
    { name: "MEDIUM", value: counts.MEDIUM },
    { name: "LOW", value: counts.LOW },
  ];

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <p className="text-sm font-semibold text-white">Severity mix</p>
      <div className="mt-3 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={ROLE_COLORS.security_analyst[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AlertQueuePanel({
  alerts,
  totalCount,
  alertsSummary,
  contextQuery,
}: {
  alerts: Alert[];
  totalCount: number;
  alertsSummary: AlertsSummary | null;
  contextQuery: string;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time" | "severity" | "wallet" | "type">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const pageSizeOptions = [8, 20, 50];
  const severityRank = useMemo<Record<string, number>>(() => ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }), []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
      const keyword = searchTerm.trim().toLowerCase();
      const matchesKeyword =
        keyword.length === 0 ||
        alert.wallet_address.toLowerCase().includes(keyword) ||
        alert.alert_type.toLowerCase().includes(keyword) ||
        alert.message.toLowerCase().includes(keyword);
      return matchesSeverity && matchesKeyword;
    });
  }, [alerts, searchTerm, severityFilter]);

  const sortedAlerts = useMemo(() => {
    const sorted = [...filteredAlerts].sort((left, right) => {
      const multiplier = sortDir === "asc" ? 1 : -1;
      if (sortBy === "wallet") return left.wallet_address.localeCompare(right.wallet_address) * multiplier;
      if (sortBy === "type") return left.alert_type.localeCompare(right.alert_type) * multiplier;
      if (sortBy === "severity") return ((severityRank[left.severity] || 0) - (severityRank[right.severity] || 0)) * multiplier;
      return (new Date(left.detected_at).getTime() - new Date(right.detected_at).getTime()) * multiplier;
    });
    return sorted;
  }, [filteredAlerts, sortBy, sortDir, severityRank]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, sortedAlerts.length) / pageSize));
  const pagedAlerts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedAlerts.slice(startIndex, startIndex + pageSize);
  }, [page, sortedAlerts, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onSort(column: "time" | "severity" | "wallet" | "type") {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir(column === "time" ? "desc" : "asc");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              placeholder="Search wallet, type, message"
              className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-slate-500/50"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(event) => {
              setSeverityFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
          >
            <option value="all">All severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("wallet")} className="hover:text-white">Wallet</button></th>
                <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("severity")} className="hover:text-white">Severity</button></th>
                <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("type")} className="hover:text-white">Type</button></th>
                <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("time")} className="hover:text-white">Time</button></th>
                <th className="px-4 py-3 text-left font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
              {pagedAlerts.map((alert) => (
                <tr key={alert.alert_id}>
                  <td className="px-4 py-3">{formatAddress(alert.wallet_address)}</td>
                  <td className="px-4 py-3"><SeverityPill severity={alert.severity} /></td>
                  <td className="px-4 py-3">{alert.alert_type}</td>
                  <td className="px-4 py-3">{formatDateTime(alert.detected_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/insights/wallet/${encodeURIComponent(alert.wallet_address)}${contextQuery}`} className="inline-flex items-center gap-1 text-slate-300 hover:text-slate-200">
                      Wallet
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {pagedAlerts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No alerts match current filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePager
          page={page}
          totalPages={totalPages}
          onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
          onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          itemCount={Math.max(totalCount, sortedAlerts.length)}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
      <div className="space-y-3">
        <AlertSeverityCard alertsSummary={alertsSummary} alerts={filteredAlerts} />
      </div>
    </div>
  );
}

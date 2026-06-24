"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/lib/toast-context";
import type { CaseItem, CaseSummary } from "../dashboard-utils";
import {
  MetricBlock,
  TablePager,
  formatAddress,
  formatCompact,
  formatPercent,
} from "../dashboard-utils";

export default function CaseQueuePanel({
  cases,
  totalCount,
  caseSummary,
  contextQuery,
}: {
  cases: CaseItem[];
  totalCount: number;
  caseSummary: CaseSummary | null;
  contextQuery: string;
}) {
  const { notify } = useToast();
  const [mutableCases, setMutableCases] = useState(cases);
  const [actingTxHash, setActingTxHash] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"risk" | "status" | "tx">("risk");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const pageSizeOptions = [8, 20, 50];

  useEffect(() => {
    setMutableCases(cases);
  }, [cases]);

  const filteredCases = useMemo(() => {
    return mutableCases.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const keyword = searchTerm.trim().toLowerCase();
      const matchesKeyword =
        keyword.length === 0 ||
        item.tx_hash.toLowerCase().includes(keyword) ||
        item.from_address.toLowerCase().includes(keyword) ||
        item.to_address.toLowerCase().includes(keyword) ||
        (item.flag_reason || "").toLowerCase().includes(keyword);
      return matchesStatus && matchesKeyword;
    });
  }, [mutableCases, searchTerm, statusFilter]);

  const sortedCases = useMemo(() => {
    const sorted = [...filteredCases].sort((left, right) => {
      const multiplier = sortDir === "asc" ? 1 : -1;
      if (sortBy === "status") return left.status.localeCompare(right.status) * multiplier;
      if (sortBy === "tx") return left.tx_hash.localeCompare(right.tx_hash) * multiplier;
      return ((left.risk_score ?? 0) - (right.risk_score ?? 0)) * multiplier;
    });
    return sorted;
  }, [filteredCases, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, sortedCases.length) / pageSize));
  const pagedCases = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedCases.slice(startIndex, startIndex + pageSize);
  }, [page, sortedCases, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onSort(column: "risk" | "status" | "tx") {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir(column === "risk" ? "desc" : "asc");
  }

  async function handleCaseAction(txHash: string, action: "CONFIRM_FRAUD" | "DISMISS" | "ESCALATE") {
    setActingTxHash(txHash);
    try {
      const response = await authFetch(`/api/cases/${encodeURIComponent(txHash)}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to apply case action");
      }

      const payload = await response.json();
      const newStatus = (payload?.new_status || payload?.data?.new_status || "").toString();
      if (!newStatus) return;

      setMutableCases((previous) =>
        previous.map((item) =>
          item.tx_hash === txHash
            ? { ...item, status: newStatus, updated_at: new Date().toISOString() }
            : item
        )
      );
      notify(`Case ${txHash.slice(0, 10)}... -> ${newStatus}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply case action";
      notify(message, "error");
    } finally {
      setActingTxHash(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Pending" value={formatCompact(caseSummary?.totals.PENDING ?? 0)} helper="Case queue" tone="amber" />
        <MetricBlock label="Verified" value={formatCompact(caseSummary?.totals.VERIFIED ?? 0)} helper="Analyst review" tone="teal" />
        <MetricBlock label="Fraud" value={formatCompact(caseSummary?.totals.FRAUD ?? 0)} helper="Confirmed risk" tone="amber" />
        <MetricBlock label="Unassigned" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Assignment gap" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search tx hash or wallet"
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-slate-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        >
          <option value="all">All statuses</option>
          <option value="PENDING">PENDING</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="FRAUD">FRAUD</option>
          <option value="ignored">ignored</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("tx")} className="hover:text-white">TX Hash</button></th>
              <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("risk")} className="hover:text-white">Risk</button></th>
              <th className="px-4 py-3 text-left font-medium"><button type="button" onClick={() => onSort("status")} className="hover:text-white">Status</button></th>
              <th className="px-4 py-3 text-left font-medium">Flag</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
              <th className="px-4 py-3 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {pagedCases.map((item) => (
              <tr key={item.tx_hash}>
                <td className="px-4 py-3 font-mono text-xs">{formatAddress(item.tx_hash)}</td>
                <td className="px-4 py-3">{item.risk_score != null ? formatPercent(item.risk_score * 100) : "-"}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">{item.flag_reason ?? (item.is_flagged ? "Flagged" : "-")}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={actingTxHash === item.tx_hash}
                      onClick={() => void handleCaseAction(item.tx_hash, "CONFIRM_FRAUD")}
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                    >
                      Fraud
                    </button>
                    <button
                      type="button"
                      disabled={actingTxHash === item.tx_hash}
                      onClick={() => void handleCaseAction(item.tx_hash, "DISMISS")}
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      disabled={actingTxHash === item.tx_hash}
                      onClick={() => void handleCaseAction(item.tx_hash, "ESCALATE")}
                      className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white disabled:opacity-60"
                    >
                      Escalate
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/insights/case/${encodeURIComponent(item.tx_hash)}${contextQuery}`} className="inline-flex items-center gap-1 text-slate-300 hover:text-slate-200">
                    Case
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {pagedCases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No cases match current filters.</td>
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
        itemCount={Math.max(totalCount, sortedCases.length)}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

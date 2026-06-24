"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CaseItem, CaseSummary } from "../dashboard-utils";
import {
  MetricBlock,
  TablePager,
  formatAddress,
  formatCompact,
  formatPercent,
} from "../dashboard-utils";

export default function CaseDataPanel({ cases, caseSummary, contextQuery }: { cases: CaseItem[]; caseSummary: CaseSummary | null; contextQuery: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizeOptions = [10, 20, 50];

  const totalPages = Math.max(1, Math.ceil(cases.length / pageSize));
  const pagedCases = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return cases.slice(startIndex, startIndex + pageSize);
  }, [cases, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Total cases" value={formatCompact(cases.length)} helper="Current dataset" tone="teal" />
        <MetricBlock label="Flagged" value={formatCompact(cases.filter((item) => item.is_flagged).length)} helper="Risk signals" tone="amber" />
        <MetricBlock label="Assigned" value={formatCompact(cases.filter((item) => Boolean(item.assigned_to)).length)} helper="Has owner" tone="slate" />
        <MetricBlock label="Unassigned" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Assignment gap" tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tx</th>
              <th className="px-4 py-3 text-left font-medium">Risk</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Assigned</th>
              <th className="px-4 py-3 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {pagedCases.map((item) => (
              <tr key={item.tx_hash}>
                <td className="px-4 py-3 font-mono text-xs">{formatAddress(item.tx_hash)}</td>
                <td className="px-4 py-3">{item.risk_score != null ? formatPercent(item.risk_score * 100) : "-"}</td>
                <td className="px-4 py-3">{item.status}</td>
                <td className="px-4 py-3">{item.assigned_to ?? "-"}</td>
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
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No cases available.</td>
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
        itemCount={cases.length}
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

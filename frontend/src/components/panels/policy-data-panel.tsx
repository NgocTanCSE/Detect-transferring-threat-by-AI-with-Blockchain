"use client";

import { useEffect, useMemo, useState } from "react";
import type { PolicyRuleItem, ReportingSummary } from "../dashboard-utils";
import {
  EmptyState,
  MetricBlock,
  TablePager,
  formatCompact,
  formatPercent,
} from "../dashboard-utils";

export default function PolicyDataPanel({ policies, reportingSummary }: { policies: PolicyRuleItem[]; reportingSummary: ReportingSummary | null }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageSizeOptions = [10, 20, 50];

  const totalPages = Math.max(1, Math.ceil(policies.length / pageSize));
  const pagedPolicies = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return policies.slice(startIndex, startIndex + pageSize);
  }, [policies, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!policies.length) {
    return <EmptyState message="No policy data available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Rules" value={formatCompact(policies.length)} helper="All policy records" tone="teal" />
        <MetricBlock label="Active" value={formatCompact(policies.filter((item) => item.is_active).length)} helper="Enforced now" tone="teal" />
        <MetricBlock label="Avg threshold" value={`${(policies.reduce((sum, item) => sum + item.min_risk_score, 0) / Math.max(1, policies.length)).toFixed(1)}`} helper="Risk floor" tone="slate" />
        <MetricBlock label="Blocked total" value={formatCompact(reportingSummary?.kpis?.blocked_total ?? 0)} helper="30-day impact" tone="amber" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Rule</th>
              <th className="px-4 py-3 text-left font-medium">Threshold</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Notify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {pagedPolicies.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.rule_name}</td>
                <td className="px-4 py-3">{item.min_risk_score}</td>
                <td className="px-4 py-3">{item.priority}</td>
                <td className="px-4 py-3">{item.notify_on_block ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        itemCount={policies.length}
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

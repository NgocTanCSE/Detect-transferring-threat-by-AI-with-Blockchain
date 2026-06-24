"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditCompleteness, AuditGaps } from "../dashboard-utils";
import {
  MetricBlock,
  TablePager,
  formatCompact,
  formatPercent,
} from "../dashboard-utils";

export default function AuditDataPanel({ auditCompleteness, auditGaps }: { auditCompleteness: AuditCompleteness | null; auditGaps: AuditGaps | null }) {
  const checks = useMemo(() => auditCompleteness?.checks ?? [], [auditCompleteness]);
  const missingActions = useMemo(() => auditGaps?.missing_actions ?? [], [auditGaps]);

  const [checksPage, setChecksPage] = useState(1);
  const [missingPage, setMissingPage] = useState(1);
  const pageSize = 5;

  const checksTotalPages = Math.max(1, Math.ceil(checks.length / pageSize));
  const missingTotalPages = Math.max(1, Math.ceil(missingActions.length / pageSize));

  // Reset page if out of bounds (e.g. data refresh)
  useEffect(() => {
    if (checksPage > checksTotalPages) setChecksPage(Math.max(1, checksTotalPages));
  }, [checksTotalPages, checksPage]);

  useEffect(() => {
    if (missingPage > missingTotalPages) setMissingPage(Math.max(1, missingTotalPages));
  }, [missingTotalPages, missingPage]);

  const pagedChecks = useMemo(() => {
    const startIndex = (checksPage - 1) * pageSize;
    return checks.slice(startIndex, startIndex + pageSize);
  }, [checks, checksPage]);

  const pagedMissing = useMemo(() => {
    const startIndex = (missingPage - 1) * pageSize;
    return missingActions.slice(startIndex, startIndex + pageSize);
  }, [missingActions, missingPage]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Completeness" value={formatPercent(auditCompleteness?.completeness_pct ?? 0)} helper="Audit coverage" tone="teal" />
        <MetricBlock label="required" value={formatCompact(auditCompleteness?.required_actions ?? 0)} helper="required actions" tone="teal" />
        <MetricBlock label="Present" value={formatCompact(auditCompleteness?.present_actions ?? 0)} helper="Captured actions" tone="teal" />
        <MetricBlock label="Missing" value={formatCompact(auditGaps?.missing_count ?? 0)} helper="Outstanding gaps" tone="teal" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div key="audit-checks-card" className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-white">Audit checks</p>
          <div className="mt-3 flex-grow space-y-2 text-sm text-slate-300">
            {pagedChecks.length ? pagedChecks.map((item, idx) => (
              <div key={`check-${item.action_type}-${idx}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                <span>{item.action_type}</span>
                <span>{item.count} · {item.present ? "PRESENT" : "MISSING"}</span>
              </div>
            )) : <p className="text-slate-500">No audit checks found.</p>}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-3">
            <TablePager
              key="checks-pager"
              page={checksPage}
              totalPages={checksTotalPages}
              onPrev={() => setChecksPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setChecksPage((prev) => Math.min(checksTotalPages, prev + 1))}
              itemCount={checks.length}
              pageSize={pageSize}
              onPageSizeChange={() => { }}
            />
          </div>
        </div>

        <div key="missing-actions-card" className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-white">Missing actions</p>
          <div className="mt-3 flex-grow space-y-2 text-sm text-slate-300">
            {pagedMissing.length ? pagedMissing.map((item, idx) => (
              <div key={`missing-${item.action_type}-${idx}`} className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-slate-200">
                <p className="font-medium">{item.action_type}</p>
                <p className="text-xs text-slate-400 mt-1">Owner: {item.owner_role} · {item.reason}</p>
              </div>
            )) : <p className="text-slate-500">No missing actions.</p>}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-3">
            <TablePager
              key="missing-pager"
              page={missingPage}
              totalPages={missingTotalPages}
              onPrev={() => setMissingPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setMissingPage((prev) => Math.min(missingTotalPages, prev + 1))}
              itemCount={missingActions.length}
              pageSize={pageSize}
              onPageSizeChange={() => { }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

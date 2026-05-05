"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History } from "lucide-react";

type CaseHistoryResponse = {
  tx_hash: string;
  status: string;
  assigned_to: string | null;
  history: Array<{
    id: string;
    action: string;
    state: string;
    analyst_id: string | null;
    note: string | null;
    created_at: string | null;
  }>;
};

async function fetchCaseHistory(txHash: string): Promise<CaseHistoryResponse> {
  const response = await fetch(`/api/cases/${encodeURIComponent(txHash)}/history`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch case history");
  }
  return response.json();
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function CaseInsightPage() {
  return (
    <Suspense fallback={<InsightFallback title="Case Drill-down" />}>
      <CaseInsightContent />
    </Suspense>
  );
}

function CaseInsightContent() {
  const params = useParams<{ txHash: string }>();
  const txHash = decodeURIComponent(params.txHash || "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["caseInsight", txHash],
    queryFn: () => fetchCaseHistory(txHash),
    enabled: !!txHash,
  });
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const feature = searchParams.get("feature");
  const backQuery = role || feature ? `?${new URLSearchParams({ role: role ?? "system_admin", feature: feature ?? "0" }).toString()}` : "";
  const backHref = `/${backQuery}`;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Case Drill-down</h1>
            <p className="mt-1 font-mono text-xs text-slate-400 break-all">{txHash}</p>
          </div>
          <div className="text-xs text-slate-500">
            <Link href={backHref} className="hover:text-slate-300">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Case insight</span>
          </div>
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to context
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Metric title="Current status" value={isLoading || !data ? "-" : data.status} />
          <Metric title="Assigned to" value={isLoading || !data ? "-" : data.assigned_to || "Unassigned"} />
          <Metric title="History items" value={isLoading || !data ? "-" : String(data.history.length)} />
        </div>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <h2 className="mb-3 text-lg font-semibold text-white">Case Action Timeline</h2>
          {isLoading ? <p className="text-slate-400">Loading case history...</p> : null}
          {error ? <p className="text-red-300">Cannot load case history.</p> : null}
          {!isLoading && !error ? (
            <div className="space-y-2">
              {(data?.history || []).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-slate-100">
                      <History className="h-4 w-4 text-slate-400" />
                      {entry.action}
                    </span>
                    <span className="text-cyan-300">{entry.state}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Analyst: {entry.analyst_id || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
                  {entry.note ? <p className="mt-2 text-sm text-slate-300">{entry.note}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function InsightFallback({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6 text-slate-400">
      {title} loading...
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white break-all">{value}</p>
    </div>
  );
}

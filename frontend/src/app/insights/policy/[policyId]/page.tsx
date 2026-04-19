"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";

type PolicyRule = {
  id: string;
  rule_name: string;
  description: string | null;
  min_risk_score: number;
  block_blacklisted: boolean;
  block_suspended: boolean;
  notify_on_block: boolean;
  priority: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

async function fetchPolicies(): Promise<PolicyRule[]> {
  const response = await fetch("/api/ops/compliance/policy-rules", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch policy rules");
  }
  const data = await response.json();
  return data.items || [];
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function PolicyInsightPage() {
  const params = useParams<{ policyId: string }>();
  const searchParams = useSearchParams();
  const policyId = decodeURIComponent(params.policyId || "");
  const role = searchParams.get("role");
  const feature = searchParams.get("feature");
  const backQuery = role || feature ? `?${new URLSearchParams({ role: role ?? "system_admin", feature: feature ?? "0" }).toString()}` : "";
  const backHref = `/${backQuery}`;

  const { data: policies, isLoading, error } = useQuery({
    queryKey: ["policyInsightRules"],
    queryFn: fetchPolicies,
  });

  const policy = (policies || []).find((item) => item.id === policyId);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Policy Drill-down</h1>
            <p className="mt-1 text-xs text-slate-400">Policy ID: {policyId}</p>
          </div>
          <div className="text-xs text-slate-500">
            <Link href={backHref} className="hover:text-slate-300">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Policy insight</span>
          </div>
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to context
          </Link>
        </div>

        {isLoading ? <p className="text-slate-400">Loading policy...</p> : null}
        {error ? <p className="text-red-300">Cannot load policy data.</p> : null}
        {!isLoading && !error && !policy ? <p className="text-slate-400">Policy not found.</p> : null}

        {policy ? (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <h2 className="text-lg font-semibold text-white">{policy.rule_name}</h2>
              <p className="mt-2 text-sm text-slate-300">{policy.description || "No description"}</p>
            </section>

            <div className="grid gap-4 md:grid-cols-3">
              <Metric title="Risk threshold" value={String(policy.min_risk_score)} />
              <Metric title="Priority" value={String(policy.priority)} />
              <Metric title="Active" value={policy.is_active ? "Yes" : "No"} />
            </div>

            <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
              <h3 className="mb-3 text-base font-semibold text-white">Control switches</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-400" /> Block blacklisted: {policy.block_blacklisted ? "Yes" : "No"}</li>
                <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-400" /> Block suspended: {policy.block_suspended ? "Yes" : "No"}</li>
                <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-400" /> Notify on block: {policy.notify_on_block ? "Yes" : "No"}</li>
              </ul>
              <p className="mt-4 text-xs text-slate-500">Created: {formatDateTime(policy.created_at)}</p>
              <p className="text-xs text-slate-500">Updated: {formatDateTime(policy.updated_at)}</p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

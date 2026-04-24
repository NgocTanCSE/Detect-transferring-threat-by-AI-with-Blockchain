"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { useToast } from "@/lib/toast-context";

type PolicyRuleItem = {
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

type ReportingSummary = {
  kpis: {
    blocked_total: number;
    policy_rules_active: number;
    notifications_sent: number;
    audit_events: number;
  };
};

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function MetricBlock({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "amber" | "rose" | "violet" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-zinc-500/30 bg-zinc-500/10"
      : tone === "rose"
        ? "border-zinc-500/30 bg-zinc-500/10"
        : tone === "violet"
          ? "border-zinc-500/30 bg-zinc-500/10"
          : "border-zinc-500/30 bg-zinc-500/10";

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{helper}</p>
    </div>
  );
}

function TablePager({
  page,
  totalPages,
  onPrev,
  onNext,
  itemCount,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  itemCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
}) {
  const start = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(itemCount, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
      <span>
        Showing {start}-{end} of {itemCount}
      </span>
      <div className="flex items-center gap-2">
        {pageSizeOptions && onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}/page
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 hover:border-zinc-500"
        >
          Prev
        </button>
        <span>
          Page {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50 hover:border-zinc-500"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function PolicyRulesPanel({
  policies,
  reportingSummary,
  contextQuery,
}: {
  policies: PolicyRuleItem[];
  reportingSummary: ReportingSummary | null;
  contextQuery: string;
}) {
  const { notify } = useToast();
  const [mutablePolicies, setMutablePolicies] = useState(policies);
  const [isMutating, setIsMutating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"rule" | "priority" | "threshold" | "active">("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const pageSizeOptions = [8, 20, 50];

  useEffect(() => {
    setMutablePolicies(policies);
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    return mutablePolicies.filter((policy) => {
      const matchesActive = activeFilter === "all" || (activeFilter === "active" ? policy.is_active : !policy.is_active);
      const keyword = searchTerm.trim().toLowerCase();
      const matchesKeyword =
        keyword.length === 0 ||
        policy.rule_name.toLowerCase().includes(keyword) ||
        (policy.description || "").toLowerCase().includes(keyword);
      return matchesActive && matchesKeyword;
    });
  }, [activeFilter, mutablePolicies, searchTerm]);

  const sortedPolicies = useMemo(() => {
    const sorted = [...filteredPolicies].sort((left, right) => {
      const multiplier = sortDir === "asc" ? 1 : -1;
      if (sortBy === "rule") return left.rule_name.localeCompare(right.rule_name) * multiplier;
      if (sortBy === "priority") return (left.priority - right.priority) * multiplier;
      if (sortBy === "threshold") return (left.min_risk_score - right.min_risk_score) * multiplier;
      return (Number(left.is_active) - Number(right.is_active)) * multiplier;
    });
    return sorted;
  }, [filteredPolicies, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedPolicies.length / pageSize));
  const pagedPolicies = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedPolicies.slice(startIndex, startIndex + pageSize);
  }, [page, sortedPolicies, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function onSort(column: "rule" | "priority" | "threshold" | "active") {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir(column === "rule" ? "asc" : "desc");
  }

  async function reloadPolicies() {
    const response = await fetch("/api/ops/compliance/policy-rules");
    if (!response.ok) throw new Error("Failed to reload policies");
    const payload = await response.json();
    const data = payload?.data ?? payload;
    setMutablePolicies(data.items || []);
  }

  async function handleCreatePolicy() {
    const ruleName = window.prompt("Rule name, vi du: Block High Velocity Wallet");
    if (!ruleName || !ruleName.trim()) return;
    const minRiskRaw = window.prompt("Min risk score (0-100)", "80");
    if (!minRiskRaw) return;
    const minRisk = Number(minRiskRaw);
    if (!Number.isFinite(minRisk) || minRisk < 0 || minRisk > 100) {
      notify("Min risk score phai nam trong khoang 0-100", "error");
      return;
    }

    const priorityRaw = window.prompt("Priority (so nho = uu tien cao)", "100");
    if (!priorityRaw) return;
    const priority = Number(priorityRaw);
    if (!Number.isInteger(priority)) {
      notify("Priority phai la so nguyen", "error");
      return;
    }

    const description = window.prompt("Description (optional)") ?? "";

    setIsMutating(true);
    try {
      const response = await fetch("/api/ops/compliance/policy-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: ruleName.trim(),
          description: description.trim() || null,
          min_risk_score: minRisk,
          priority,
          is_active: true,
          block_blacklisted: true,
          block_suspended: true,
          notify_on_block: true,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create policy");
      }
      await reloadPolicies();
      notify("Policy created", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create policy";
      notify(message, "error");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleTogglePolicy(policy: PolicyRuleItem) {
    setIsMutating(true);
    try {
      const response = await fetch(`/api/ops/compliance/policy-rules/${encodeURIComponent(policy.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !policy.is_active }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update policy");
      }

      setMutablePolicies((previous) =>
        previous.map((item) =>
          item.id === policy.id
            ? { ...item, is_active: !item.is_active, updated_at: new Date().toISOString() }
            : item
        )
      );
      notify(`Policy ${policy.rule_name} ${policy.is_active ? "disabled" : "enabled"}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update policy";
      notify(message, "error");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeletePolicy(policy: PolicyRuleItem) {
    const confirmed = window.confirm(`Xoa policy \"${policy.rule_name}\"?`);
    if (!confirmed) return;

    setIsMutating(true);
    try {
      const response = await fetch(`/api/ops/compliance/policy-rules/${encodeURIComponent(policy.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to delete policy");
      }

      setMutablePolicies((previous) => previous.filter((item) => item.id !== policy.id));
      notify(`Policy ${policy.rule_name} deleted`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete policy";
      notify(message, "error");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock
          label="Active rules"
          value={formatCompact(reportingSummary?.kpis.policy_rules_active ?? mutablePolicies.filter((item) => item.is_active).length)}
          helper="Enforcement surface"
          tone="amber"
        />
        <MetricBlock
          label="Blocked transfers"
          value={formatCompact(reportingSummary?.kpis.blocked_total ?? 0)}
          helper="30-day count"
          tone="rose"
        />
        <MetricBlock
          label="Notifications sent"
          value={formatCompact(reportingSummary?.kpis.notifications_sent ?? 0)}
          helper="Delivery trail"
          tone="violet"
        />
        <MetricBlock
          label="Audit events"
          value={formatCompact(reportingSummary?.kpis.audit_events ?? 0)}
          helper="Evidence trail"
          tone="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isMutating}
          onClick={() => void handleCreatePolicy()}
          className="h-10 rounded-xl border border-zinc-500/20 bg-zinc-800/40 text-zinc-100 hover:border-zinc-400/60"
        >
          Add policy
        </button>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -tranzinc-y-1/2 text-zinc-500" />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search rule name or description"
            className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-500/50"
          />
        </div>
        <select
          value={activeFilter}
          onChange={(event) => {
            setActiveFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none"
        >
          <option value="all">All policies</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-700">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("rule")} className="hover:text-white">
                  Rule
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("threshold")} className="hover:text-white">
                  Threshold
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("priority")} className="hover:text-white">
                  Priority
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("active")} className="hover:text-white">
                  Active
                </button>
              </th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
              <th className="px-4 py-3 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/60 text-zinc-200">
            {pagedPolicies.map((policy) => (
              <tr key={policy.id}>
                <td className="px-4 py-3">{policy.rule_name}</td>
                <td className="px-4 py-3">{policy.min_risk_score}</td>
                <td className="px-4 py-3">{policy.priority}</td>
                <td className="px-4 py-3">{policy.is_active ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleTogglePolicy(policy)}
                      className="rounded-md border border-zinc-500/40 bg-zinc-500/10 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-60"
                    >
                      {policy.is_active ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => void handleDeletePolicy(policy)}
                      className="rounded-md border border-zinc-500/40 bg-zinc-500/10 px-2 py-1 text-[11px] text-zinc-200 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/insights/policy/${encodeURIComponent(policy.id)}${contextQuery}`}
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-zinc-200"
                  >
                    Policy
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {pagedPolicies.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-zinc-500">
                  No policies match current filters.
                </td>
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
        itemCount={sortedPolicies.length}
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

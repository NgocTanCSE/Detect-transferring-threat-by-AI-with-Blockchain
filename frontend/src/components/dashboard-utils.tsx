"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { 
  AlertTriangle, Brain, ChartColumn, ExternalLink, FileCheck2, Gauge, Globe2, Loader2, 
  RefreshCcw, Search, Shield, Sparkles, Wallet, Download, Archive, Send, MessageSquare 
} from "lucide-react";
import type { Alert, BlockedTransfer, DashboardStats, FlowStats } from "@/lib/api";

export type RoleKey = "system_admin" | "ai_data_engineer" | "security_analyst" | "compliance_risk_manager";

export type RoleDefinition = {
  key: RoleKey;
  label: string;
  shortLabel: string;
  accentClass: string;
  highlightClass: string;
  sidebarFeatures: string[];
};

export function mapUserRoleToDashboardRole(role?: string | null): RoleKey {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "system_admin") return "system_admin";
  if (normalized === "ai_data_engineer" || normalized === "data_engineer") return "ai_data_engineer";
  if (normalized === "compliance_risk_manager" || normalized === "compliance") return "compliance_risk_manager";
  if (normalized === "security_analyst" || normalized === "analyst") return "security_analyst";
  return "system_admin";
}

export function isUserAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "system_admin";
}

export type NodeEndpointItem = {
  id: string;
  provider_name: string;
  chain: string;
  endpoint_url: string;
  protocol: string;
  priority: number;
  is_active: boolean;
  health_status: string;
  last_error: string | null;
  last_checked_at: string | null;
};

export type PipelineMetricItem = {
  id: number;
  chain: string;
  block_number: number | null;
  throughput_tps: number | null;
  ingestion_latency_ms: number | null;
  decode_latency_ms: number | null;
  inserted_at: string | null;
};

export type FeatureConfigItem = {
  id: string;
  feature_key: string;
  enabled: boolean;
  expression: string | null;
  owner_user_id: string | null;
  updated_at: string | null;
};

export type ModelRegistryItem = {
  id: string;
  model_name: string;
  version: string;
  artifact_uri: string;
  framework: string;
  is_active: boolean;
  promoted_by: string | null;
  promoted_at: string | null;
  created_at: string | null;
};

export type PolicyRuleItem = {
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

export type NotificationItem = {
  id: string;
  channel: string;
  recipient: string;
  severity: string;
  message: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  sent_at: string | null;
};

export type CaseItem = {
  tx_hash: string;
  from_address: string;
  to_address: string;
  value: string;
  risk_score: number | null;
  status: string;
  assigned_to: string | null;
  is_flagged: boolean;
  flag_reason: string | null;
  timestamp: string | null;
  updated_at: string | null;
};

export type AlertsSummary = {
  today: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type CaseSummary = {
  totals: Record<string, number>;
  unassigned: number;
  high_risk_unassigned: number;
};

export type ReportingSummary = {
  period: { days: number; start: string; end: string };
  kpis: {
    alerts_total: number;
    critical_alerts: number;
    blocked_total: number;
    blocked_value_eth: number;
    policy_rules_active: number;
    notifications_sent: number;
    notifications_failed: number;
    audit_events: number;
  };
  cases: Record<string, number>;
};

export type ControlEffectiveness = {
  period_days: number;
  inputs: {
    actionable_alerts: number;
    blocked_total: number;
    fraud_cases: number;
    ignored_cases: number;
  };
  metrics: {
    block_rate_pct: number;
    fraud_precision_proxy_pct: number;
    decision_coverage: number;
  };
};

export type AuditCompleteness = {
  period_days: number;
  required_actions: number;
  present_actions: number;
  completeness_pct: number;
  checks: Array<{
    action_type: string;
    count: number;
    present: boolean;
  }>;
};

export type AuditGaps = {
  period_days: number;
  missing_count: number;
  missing_actions: Array<{
    action_type: string;
    owner_role: string;
    reason: string;
    recommended_next_step: string;
  }>;
};

export type SloMetrics = {
  period_days: number;
  endpoint_health: {
    total: number;
    active: number;
    healthy_active: number;
    availability_pct: number;
    error_budget_burn_pct: number;
  };
  latency_slo: {
    ingest_target_ms: number;
    decode_target_ms: number;
    ingest_p95_ms: number;
    decode_p95_ms: number;
    ingest_breaches: number;
    decode_breaches: number;
    sample_points: number;
  };
};

export type DataIntegrityReport = {
  overall_ok: boolean;
  counts: Record<string, number>;
  checks: Array<{
    key: string;
    ok: boolean;
    required_min: number;
    actual: number;
    owner_role: string;
  }>;
  missing_controls: Array<{
    key: string;
    owner_role: string;
    required_min: number;
    actual: number;
    severity: string;
    recommended_next_step: string;
  }>;
  role_readiness: Record<string, boolean>;
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "system_admin",
    label: "System Admin",
    shortLabel: "SYS",
    accentClass: "border-teal-400/40 bg-teal-400/10 text-teal-50",
    highlightClass: "from-teal-400/20 via-teal-500/10 to-transparent",
    sidebarFeatures: ["Health", "Organizations", "API Access", "Pipeline Ops", "Diagnostics Logs", "SLO Data"],
  },
  {
    key: "ai_data_engineer",
    label: "AI Data Engineer",
    shortLabel: "AI",
    accentClass: "border-amber-400/40 bg-amber-400/10 text-amber-50",
    highlightClass: "from-amber-400/20 via-amber-500/10 to-transparent",
    sidebarFeatures: ["Model State", "Feature State", "Feature Ops", "Model Ops", "Feature Data", "Registry Data"],
  },
  {
    key: "security_analyst",
    label: "Security Analyst",
    shortLabel: "SEC",
    accentClass: "border-slate-300/40 bg-slate-300/10 text-slate-50",
    highlightClass: "from-slate-300/20 via-slate-400/10 to-transparent",
    sidebarFeatures: ["Alert Queue", "Case Queue", "Case Actions", "Notifications", "Alert Data", "Case Data"],
  },
  {
    key: "compliance_risk_manager",
    label: "Compliance Risk Manager",
    shortLabel: "CMP",
    accentClass: "border-teal-300/40 bg-teal-300/10 text-teal-50",
    highlightClass: "from-teal-300/20 via-teal-400/10 to-transparent",
    sidebarFeatures: ["Policy State", "Audit State", "Batch Upload", "Reporting", "Policy Data", "Audit Data"],
  },
];

export const SIDEBAR_GROUPS: Array<{ title: string; start: number; end: number }> = [
  { title: "Overview", start: 0, end: 2 },
  { title: "Functions", start: 2, end: 4 },
  { title: "Data", start: 4, end: 6 },
];

export const ROLE_ICONS = [Gauge, ChartColumn, Brain, Shield, FileCheck2, Wallet];

export const ROLE_COLORS: Record<RoleKey, string[]> = {
  system_admin: ["#0f766e", "#14b8a6", "#5eead4"],
  ai_data_engineer: ["#d97706", "#f59e0b", "#fbbf24"],
  security_analyst: ["#475569", "#94a3b8", "#cbd5e1"],
  compliance_risk_manager: ["#0f766e", "#d97706", "#f59e0b"],
};

export const QUICK_ROUTES = [
  { label: "User Exchange", href: "/user/exchange" },
  { label: "User History", href: "/user/history" },
];

export const TONAL_STYLES: Record<string, string> = {
  teal: "border-slate-500/20 bg-slate-900/50 text-slate-100",
  blue: "border-teal-400/20 bg-teal-500/10 text-teal-100",
  red: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  green: "border-teal-500/20 bg-teal-500/10 text-teal-100",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  purple: "border-slate-400/20 bg-slate-500/10 text-slate-100",
  emerald: "border-teal-400/20 bg-teal-500/10 text-teal-100",
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function fetchJson<T>(url: string, defaultValue: T | null = null): Promise<T> {
  try {
    const response = await authFetch(`${API_BASE}${url}`);
    if (!response.ok) {
      console.warn(`API request failed: ${url} (${response.status})`);
      if (defaultValue !== null) return defaultValue;
      throw new Error(`Request failed: ${url}`);
    }
    const payload = await response.json();
    // Accept both legacy payloads and unified envelope payloads.
    if (payload && typeof payload === "object" && "status" in payload && "data" in payload) {
      return (payload.data as T);
    }
    return payload as T;
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    if (defaultValue !== null) return defaultValue;
    throw error;
  }
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) return "-";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatEth(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 2)} ETH`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export function countBy<T>(items: T[], resolver: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = resolver(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

export function percentage(value: number, total: number): number {
  if (!total) return 0;
  return (value / total) * 100;
}

function SeverityPill({ severity }: { severity: string }) {
  const color =
    severity === "CRITICAL"
      ? "border-slate-200/40 bg-slate-200/10 text-slate-50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
      : severity === "HIGH"
        ? "border-slate-400/30 bg-slate-400/10 text-slate-100"
        : severity === "MEDIUM"
          ? "border-slate-600/30 bg-slate-600/10 text-slate-300"
          : "border-slate-800/30 bg-slate-800/10 text-slate-500";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${color}`}>{severity}</span>;
}

function CardShell({ title, subtitle, children, icon: Icon }: { title: string; subtitle: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <section className="animate-in fade-in zoom-in-[0.98] slide-in-from-bottom-2 duration-300 ease-out rounded-3xl border border-slate-800/80 bg-slate-950/65 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-teal-400" /> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, hint, accentClass }: { label: string; value: string; hint: string; accentClass: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-50 md:text-2xl">{value}</p>
      <p className="mt-1 text-sm text-slate-300/80">{hint}</p>
    </div>
  );
}

function MetricBlock({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: keyof typeof TONAL_STYLES }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONAL_STYLES[tone]}`}>
      <p className="text-[11px] uppercase tracking-[0.28em] opacity-80">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{helper}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-sm text-slate-400">{message}</div>;
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
      <span>Showing {start}-{end} of {itemCount}</span>
      <div className="flex items-center gap-2">
        {pageSizeOptions && onPageSizeChange ? (
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>{size}/page</option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:border-slate-500">
          Prev
        </button>
        <span>Page {page}/{totalPages}</span>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 disabled:cursor-not-allowed disabled:opacity-50 hover:border-slate-500">
          Next
        </button>
      </div>
    </div>
  );
}

export function integrityRouteForKey(key: string, ownerRole: string): string {
  const basePath = "/admin/dashboard";
  if (ownerRole === "system_admin") {
    if (key.includes("node_endpoints")) return `${basePath}?role=system_admin&feature=2`;
    if (key.includes("pipeline_metrics")) return `${basePath}?role=system_admin&feature=3`;
    return `${basePath}?role=system_admin&feature=4`;
  }
  if (ownerRole === "ai_data_engineer") {
    if (key.includes("active_models")) return `${basePath}?role=ai_data_engineer&feature=3`;
    if (key.includes("feature")) return `${basePath}?role=ai_data_engineer&feature=1`;
    return `${basePath}?role=ai_data_engineer&feature=0`;
  }
  if (ownerRole === "security_analyst") {
    if (key.includes("blocked")) return `${basePath}?role=security_analyst&feature=2`;
    return `${basePath}?role=security_analyst&feature=0`;
  }
  return `${basePath}?role=compliance_risk_manager&feature=0`;
}

export { SeverityPill, CardShell, MetricCard, MetricBlock, EmptyState, TablePager };

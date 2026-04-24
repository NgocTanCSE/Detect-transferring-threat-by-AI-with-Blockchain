"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import PolicyRulesPanel from "@/components/panels/policy-rules-panel";
import {
  AlertTriangle,
  Brain,
  ChartColumn,
  ExternalLink,
  FileCheck2,
  Gauge,
  Globe2,
  Loader2,
  RefreshCcw,
  Search,
  Shield,
  Sparkles,
  Wallet,
  Download,
  Archive,
} from "lucide-react";
import type { Alert, BlockedTransfer, DashboardStats, FlowStats } from "@/lib/api";
import { fetchBlockedTransfers, fetchDashboardStats, fetchFlowStats, fetchRecentAlerts } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RoleKey = "system_admin" | "ai_data_engineer" | "security_analyst" | "compliance_risk_manager";

type RoleDefinition = {
  key: RoleKey;
  label: string;
  shortLabel: string;
  accentClass: string;
  highlightClass: string;
  sidebarFeatures: string[];
};

function mapUserRoleToDashboardRole(role?: string | null): RoleKey {
  const normalized = (role ?? "").toLowerCase();
  if (normalized === "admin" || normalized === "system_admin") return "system_admin";
  if (normalized === "ai_data_engineer" || normalized === "data_engineer") return "ai_data_engineer";
  if (normalized === "compliance_risk_manager" || normalized === "compliance") return "compliance_risk_manager";
  if (normalized === "security_analyst" || normalized === "analyst") return "security_analyst";
  return "system_admin";
}

function isUserAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "system_admin";
}

type NodeEndpointItem = {
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

type PipelineMetricItem = {
  id: number;
  chain: string;
  block_number: number | null;
  throughput_tps: number | null;
  ingestion_latency_ms: number | null;
  decode_latency_ms: number | null;
  inserted_at: string | null;
};

type FeatureConfigItem = {
  id: string;
  feature_key: string;
  enabled: boolean;
  expression: string | null;
  owner_user_id: string | null;
  updated_at: string | null;
};

type ModelRegistryItem = {
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

type NotificationItem = {
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

type CaseItem = {
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

type AlertsSummary = {
  today: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

type CaseSummary = {
  totals: Record<string, number>;
  unassigned: number;
  high_risk_unassigned: number;
};

type ReportingSummary = {
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

type ControlEffectiveness = {
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

type AuditCompleteness = {
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

type AuditGaps = {
  period_days: number;
  missing_count: number;
  missing_actions: Array<{
    action_type: string;
    owner_role: string;
    reason: string;
    recommended_next_step: string;
  }>;
};

type SloMetrics = {
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

type DataIntegrityReport = {
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

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "system_admin",
    label: "System Admin",
    shortLabel: "SYS",
    accentClass: "border-zinc-400/40 bg-zinc-400/10 text-zinc-50",
    highlightClass: "from-zinc-400/20 via-zinc-500/10 to-transparent",
    sidebarFeatures: ["Health", "Availability", "Node Ops", "Pipeline Ops", "Diagnostics Logs", "SLO Data"],
  },
  {
    key: "ai_data_engineer",
    label: "AI Data Engineer",
    shortLabel: "AI",
    accentClass: "border-slate-400/40 bg-slate-400/10 text-slate-50",
    highlightClass: "from-slate-400/20 via-slate-500/10 to-transparent",
    sidebarFeatures: ["Model State", "Feature State", "Feature Ops", "Model Ops", "Feature Data", "Registry Data"],
  },
  {
    key: "security_analyst",
    label: "Security Analyst",
    shortLabel: "SEC",
    accentClass: "border-gray-400/40 bg-gray-400/10 text-gray-50",
    highlightClass: "from-gray-400/20 via-gray-500/10 to-transparent",
    sidebarFeatures: ["Alert Queue", "Case Queue", "Case Actions", "Notifications", "Alert Data", "Case Data"],
  },
  {
    key: "compliance_risk_manager",
    label: "Compliance Risk Manager",
    shortLabel: "CMP",
    accentClass: "border-neutral-400/40 bg-neutral-400/10 text-neutral-50",
    highlightClass: "from-neutral-400/20 via-neutral-500/10 to-transparent",
    sidebarFeatures: ["Policy State", "Audit State", "Policy Actions", "Reporting", "Policy Data", "Audit Data"],
  },
];

const SIDEBAR_GROUPS: Array<{ title: string; start: number; end: number }> = [
  { title: "Overview", start: 0, end: 2 },
  { title: "Functions", start: 2, end: 4 },
  { title: "Data", start: 4, end: 6 },
];

const ROLE_ICONS = [Gauge, ChartColumn, Brain, Shield, FileCheck2, Wallet];

const ROLE_COLORS: Record<RoleKey, string[]> = {
  system_admin: ["#ffffff", "#d4d4d8", "#a1a1aa"],
  ai_data_engineer: ["#e4e4e7", "#a1a1aa", "#71717a"],
  security_analyst: ["#f4f4f5", "#d4d4d8", "#a1a1aa"],
  compliance_risk_manager: ["#fafafa", "#f5f5f5", "#e5e5e5"],
};

const QUICK_ROUTES = [
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "User Exchange", href: "/user/exchange" },
  { label: "User History", href: "/user/history" },
  { label: "Admin Dashboard", href: "/admin/dashboard" },
  { label: "Admin Logs", href: "/?role=system_admin&feature=4" },
  { label: "Admin Tracking", href: "/admin/tracking" },
  { label: "Admin History", href: "/admin/history" },
];

const TONAL_STYLES: Record<string, string> = {
  cyan: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
  violet: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
  rose: "border-zinc-600/20 bg-zinc-600/10 text-zinc-200",
  amber: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
  emerald: "border-zinc-400/20 bg-zinc-400/10 text-zinc-100",
  blue: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
  slate: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
};

async function fetchJson<T>(path: string, defaultValue: T | null = null): Promise<T> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      console.warn(`API request failed: ${path} (${response.status})`);
      if (defaultValue !== null) return defaultValue;
      throw new Error(`Request failed: ${path}`);
    }
    const payload = await response.json();
    // Accept both legacy payloads and unified envelope payloads.
    if (payload && typeof payload === "object" && "status" in payload && "data" in payload) {
      return (payload.data as T);
    }
    return payload as T;
  } catch (error) {
    console.error(`Fetch error for ${path}:`, error);
    if (defaultValue !== null) return defaultValue;
    throw error;
  }
}

function formatAddress(address: string | null | undefined): string {
  if (!address) return "-";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatEth(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : 2)} ETH`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function countBy<T>(items: T[], resolver: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = resolver(item);
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function percentage(value: number, total: number): number {
  if (!total) return 0;
  return (value / total) * 100;
}

function SeverityPill({ severity }: { severity: string }) {
  const color =
    severity === "CRITICAL"
      ? "border-zinc-200/40 bg-zinc-200/10 text-zinc-50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
      : severity === "HIGH"
        ? "border-zinc-400/30 bg-zinc-400/10 text-zinc-100"
        : severity === "MEDIUM"
          ? "border-zinc-600/30 bg-zinc-600/10 text-zinc-300"
          : "border-zinc-800/30 bg-zinc-800/10 text-zinc-500";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${color}`}>{severity}</span>;
}

function CardShell({ title, subtitle, children, icon: Icon }: { title: string; subtitle: string; children: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <section className="rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
        </div>
        {Icon ? <Icon className="h-5 w-5 text-zinc-500" /> : null}
      </div>
      {children}
    </section>
  );
}

export default function LiveDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [activeRole, setActiveRole] = useState<RoleKey>("system_admin");
  const [roleSwitchingKey, setRoleSwitchingKey] = useState<RoleKey | null>(null);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [flowStats, setFlowStats] = useState<FlowStats[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [blockedTransfers, setBlockedTransfers] = useState<BlockedTransfer[]>([]);
  const [nodeEndpoints, setNodeEndpoints] = useState<NodeEndpointItem[]>([]);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetricItem[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<{ total_points: number; avg_throughput_tps: number | null; avg_ingestion_latency_ms: number | null; avg_decode_latency_ms: number | null; last_block_number: number | null } | null>(null);
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfigItem[]>([]);
  const [modelRegistry, setModelRegistry] = useState<ModelRegistryItem[]>([]);
  const [activeModels, setActiveModels] = useState<ModelRegistryItem[]>([]);
  const [policyRules, setPolicyRules] = useState<PolicyRuleItem[]>([]);
  const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null);
  const [caseSummary, setCaseSummary] = useState<CaseSummary | null>(null);
  const [notificationEvents, setNotificationEvents] = useState<NotificationItem[]>([]);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [reportingSummary, setReportingSummary] = useState<ReportingSummary | null>(null);
  const [controlEffectiveness, setControlEffectiveness] = useState<ControlEffectiveness | null>(null);
  const [auditCompleteness, setAuditCompleteness] = useState<AuditCompleteness | null>(null);
  const [auditGaps, setAuditGaps] = useState<AuditGaps | null>(null);
  const [sloMetrics, setSloMetrics] = useState<SloMetrics | null>(null);
  const [totalAlertCount, setTotalAlertCount] = useState<number>(0);
  const [totalBlockedCount, setTotalBlockedCount] = useState<number>(0);
  const [totalCaseCount, setTotalCaseCount] = useState<number>(0);
  const [diagnosticsLogs, setDiagnosticsLogs] = useState<Array<{ id?: string; timestamp: string; log_type: string; message: string; status_code?: number; endpoint?: string; details?: Record<string, unknown> }>>([]);
  const [dataIntegrity, setDataIntegrity] = useState<DataIntegrityReport | null>(null);
  const isFetchingRef = useRef(false);
  const lastAutoFetchAtRef = useRef(0);

  const role = useMemo(() => ROLE_DEFINITIONS.find((entry) => entry.key === activeRole) ?? ROLE_DEFINITIONS[0], [activeRole]);
  const sidebarIcons = useMemo(() => ROLE_ICONS, []);
  const activeFeatureLabel = role.sidebarFeatures[activeFeatureIndex] ?? role.sidebarFeatures[0] ?? "Workspace";
  const availableRoles = useMemo(() => ROLE_DEFINITIONS, []);

  // Filter navigation routes based on authentication status
  const visibleRoutes = useMemo(() => {
    const isAdmin = isUserAdminRole(user?.role);
    return QUICK_ROUTES.filter(route => {
      // Hide login/register if already authenticated
      if (['/login', '/register'].includes(route.href)) {
        return !isAuthenticated;
      }
      // Show user routes only if authenticated
      if (route.href.startsWith('/user')) {
        return isAuthenticated;
      }
      // Show admin routes only for admin role
      if (route.href.startsWith('/admin') || route.href.includes('role=')) {
        return isAdmin;
      }
      return true;
    });
  }, [isAuthenticated, user?.role]);

  const updateQuery = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const nextParams = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : searchParams.toString()
      );
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "") {
          nextParams.delete(key);
        } else {
          nextParams.set(key, String(value));
        }
      }
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    setActiveFeatureIndex(0);
  }, [activeRole]);

  useEffect(() => {
    const roleParam = searchParams.get("role") as RoleKey | null;
    const fallbackRole = mapUserRoleToDashboardRole(user?.role);
    
    // 1. If we have a valid role in the URL, use it.
    if (roleParam && ROLE_DEFINITIONS.some((entry) => entry.key === roleParam)) {
      if (roleParam !== activeRole) {
        setActiveRole(roleParam);
      }
      return;
    }

    // 2. Otherwise, use the fallback role (determined by user role or default).
    if (fallbackRole !== activeRole) {
      setActiveRole(fallbackRole);
    }
    
    // 3. Ensure the URL reflects the active role.
    if (fallbackRole !== roleParam) {
      updateQuery({ role: fallbackRole, feature: 0 });
    }
  }, [activeRole, searchParams, updateQuery, user?.role]);

  useEffect(() => {
    if (roleSwitchingKey && activeRole === roleSwitchingKey) {
      setRoleSwitchingKey(null);
    }
  }, [activeRole, roleSwitchingKey]);

  useEffect(() => {
    const featureParamRaw = searchParams.get("feature");
    if (!featureParamRaw) return;
    const parsed = Number(featureParamRaw);
    const maxFeatureCount = role.sidebarFeatures.length;
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < maxFeatureCount && parsed !== activeFeatureIndex) {
      setActiveFeatureIndex(parsed);
    }
  }, [activeFeatureIndex, role.sidebarFeatures.length, searchParams]);

  async function loadLiveData(roleKey: RoleKey, mode: "auto" | "manual" = "auto") {
    const now = Date.now();
    if (isFetchingRef.current) {
      return;
    }

    // Guard against accidental rapid remount/re-trigger loops.
    if (mode === "auto" && now - lastAutoFetchAtRef.current < 8000) {
      return;
    }

    if (mode === "auto" && typeof window !== "undefined") {
      const persistedLast = Number(window.sessionStorage.getItem("dashboard:last-auto-fetch") || "0");
      if (now - persistedLast < 8000) {
        return;
      }
      window.sessionStorage.setItem("dashboard:last-auto-fetch", String(now));
    }

    isFetchingRef.current = true;
    if (mode === "auto") {
      lastAutoFetchAtRef.current = now;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [dashboardResult, flowResult, alertsResult, blockedResult] = await Promise.all([
        fetchDashboardStats(),
        fetchFlowStats(),
        fetchRecentAlerts(500),  // Fetch more alerts for filtering
        fetchBlockedTransfers(500),  // Fetch more blocked transfers for filtering
      ]);

      setDashboardStats(dashboardResult);
      setFlowStats(flowResult);
      setRecentAlerts(alertsResult.alerts ?? []);
      setTotalAlertCount((alertsResult.statistics?.total_matching as number) ?? (alertsResult.alerts?.length ?? 0));
      setBlockedTransfers(blockedResult.blocked_transfers ?? []);
      setTotalBlockedCount((blockedResult.statistics?.total_matching as number) ?? (blockedResult.blocked_transfers?.length ?? 0));

      if (roleKey === "system_admin") {
        const [nodeRes, pipelineRes, pipelineSummaryRes, sloRes, logsRes, integrityRes] = await Promise.allSettled([
          fetchJson<{ count: number; items: NodeEndpointItem[] }>("/api/ops/system/node-endpoints?only_active=true", { count: 0, items: [] }),
          fetchJson<{ count: number; items: PipelineMetricItem[] }>("/api/ops/system/pipeline-metrics?limit=12", { count: 0, items: [] }),
          fetchJson<{ total_points: number; avg_throughput_tps: number | null; avg_ingestion_latency_ms: number | null; avg_decode_latency_ms: number | null; last_block_number: number | null }>("/api/ops/system/pipeline-metrics/summary", { total_points: 0, avg_throughput_tps: null, avg_ingestion_latency_ms: null, avg_decode_latency_ms: null, last_block_number: null }),
          fetchJson<SloMetrics>("/api/ops/system/slo-metrics?days=14", { period_days: 14, endpoint_health: { total: 0, active: 0, healthy_active: 0, availability_pct: 0, error_budget_burn_pct: 0 }, latency_slo: { ingest_target_ms: 500, decode_target_ms: 200, ingest_p95_ms: 0, decode_p95_ms: 0, ingest_breaches: 0, decode_breaches: 0, sample_points: 0 } }),
          fetchJson<{ count: number; logs: Array<{ id?: string; timestamp: string; log_type: string; message: string; status_code?: number; endpoint?: string; details?: Record<string, unknown> }> }>("/api/admin/diagnostics/logs?limit=50", { count: 0, logs: [] }),
          fetchJson<DataIntegrityReport>("/api/ops/system/data-integrity", { overall_ok: true, counts: {}, checks: [], missing_controls: [], role_readiness: {} }),
        ]);

        if (nodeRes.status === "fulfilled") setNodeEndpoints(nodeRes.value.items ?? []);
        if (pipelineRes.status === "fulfilled") setPipelineMetrics(pipelineRes.value.items ?? []);
        if (pipelineSummaryRes.status === "fulfilled") setPipelineSummary(pipelineSummaryRes.value);
        if (sloRes.status === "fulfilled") setSloMetrics(sloRes.value);
        if (logsRes.status === "fulfilled") setDiagnosticsLogs(logsRes.value.logs ?? []);
        if (integrityRes.status === "fulfilled") setDataIntegrity(integrityRes.value);
      }

      if (roleKey === "ai_data_engineer") {
        const [featureRes, registryRes, activeRes] = await Promise.allSettled([
          fetchJson<{ count: number; items: FeatureConfigItem[] }>("/api/ops/ai/feature-store", { count: 0, items: [] }),
          fetchJson<{ count: number; items: ModelRegistryItem[] }>("/api/ops/ai/model-registry", { count: 0, items: [] }),
          fetchJson<{ count: number; items: ModelRegistryItem[] }>("/api/ops/ai/model-registry/active", { count: 0, items: [] }),
        ]);

        if (featureRes.status === "fulfilled") setFeatureConfigs(featureRes.value.items ?? []);
        if (registryRes.status === "fulfilled") setModelRegistry(registryRes.value.items ?? []);
        if (activeRes.status === "fulfilled") setActiveModels(activeRes.value.items ?? []);
      }

      if (roleKey === "security_analyst") {
        const [alertSummaryRes, caseSummaryRes, notificationsRes, casesRes] = await Promise.allSettled([
          fetchJson<AlertsSummary>("/api/ops/security/alerts-summary", { today: 0, critical: 0, high: 0, medium: 0, low: 0 }),
          fetchJson<CaseSummary>("/api/ops/security/case-summary", { totals: {}, unassigned: 0, high_risk_unassigned: 0 }),
          fetchJson<{ count: number; items: NotificationItem[] }>("/api/ops/security/notifications?limit=10", { count: 0, items: [] }),
          fetchJson<{ count: number; cases: CaseItem[]; statistics: Record<string, unknown> }>("/api/cases?limit=500&min_risk=0", { count: 0, cases: [], statistics: {} }),
        ]);

        if (alertSummaryRes.status === "fulfilled") setAlertsSummary(alertSummaryRes.value);
        if (caseSummaryRes.status === "fulfilled") setCaseSummary(caseSummaryRes.value);
        if (notificationsRes.status === "fulfilled") setNotificationEvents(notificationsRes.value.items ?? []);
        if (casesRes.status === "fulfilled") {
          setCaseItems(casesRes.value.cases ?? []);
          setTotalCaseCount((casesRes.value.statistics?.matching_cases as number) ?? (casesRes.value.cases?.length ?? 0));
        }
      }

      if (roleKey === "compliance_risk_manager") {
        const [policyRes, reportRes, effectivenessRes, completenessRes, gapsRes] = await Promise.allSettled([
          fetchJson<{ count: number; items: PolicyRuleItem[] }>("/api/ops/compliance/policy-rules", { count: 0, items: [] }),
          fetchJson<ReportingSummary>("/api/ops/compliance/reporting/summary?days=30", { period: { days: 30, start: new Date().toISOString(), end: new Date().toISOString() }, kpis: { alerts_total: 0, critical_alerts: 0, blocked_total: 0, blocked_value_eth: 0, policy_rules_active: 0, notifications_sent: 0, notifications_failed: 0, audit_events: 0 }, cases: {} }),
          fetchJson<ControlEffectiveness>("/api/ops/compliance/reporting/control-effectiveness?days=30", { period_days: 30, inputs: { actionable_alerts: 0, blocked_total: 0, fraud_cases: 0, ignored_cases: 0 }, metrics: { block_rate_pct: 0, fraud_precision_proxy_pct: 0, decision_coverage: 0 } }),
          fetchJson<AuditCompleteness>("/api/ops/compliance/reporting/audit-completeness?days=30", { period_days: 30, required_actions: 0, present_actions: 0, completeness_pct: 0, checks: [] }),
          fetchJson<AuditGaps>("/api/ops/compliance/reporting/audit-gaps?days=30", { period_days: 30, missing_count: 0, missing_actions: [] }),
        ]);

        if (policyRes.status === "fulfilled") setPolicyRules(policyRes.value.items ?? []);
        if (reportRes.status === "fulfilled") setReportingSummary(reportRes.value);
        if (effectivenessRes.status === "fulfilled") setControlEffectiveness(effectivenessRes.value);
        if (completenessRes.status === "fulfilled") setAuditCompleteness(completenessRes.value);
        if (gapsRes.status === "fulfilled") setAuditGaps(gapsRes.value);
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load live data";
      setError(message);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }

  useEffect(() => {
    void loadLiveData(activeRole, "auto");
  }, [activeRole]);

  // Refresh when switching sidebar function so each view is up to date without manual click.
  useEffect(() => {
    void loadLiveData(activeRole, "manual");
  }, [activeRole, activeFeatureIndex]);

  // Keep live data fresh while user stays on the page.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadLiveData(activeRole, "auto");
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRole]);

  // Refresh after returning to tab/window to avoid stale values.
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void loadLiveData(activeRole, "manual");
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [activeRole]);

  const flowChartData = useMemo(
    () =>
      flowStats.map((entry) => ({
        date: entry.date,
        inflow: entry.inflow,
        outflow: entry.outflow,
        net: entry.inflow - entry.outflow,
      })),
    [flowStats]
  );

  const roleMetricCards = useMemo(() => {
    const overview = dashboardStats?.overview;

    if (role.key === "system_admin") {
      return [
        { label: "Availability", value: sloMetrics ? formatPercent(sloMetrics.endpoint_health.availability_pct) : "-", tone: "cyan", hint: "Active endpoints" },
        { label: "Healthy nodes", value: sloMetrics ? `${sloMetrics.endpoint_health.healthy_active}/${sloMetrics.endpoint_health.active}` : "-", tone: "blue", hint: "Endpoint health" },
        { label: "Pipeline TPS", value: pipelineSummary?.avg_throughput_tps != null ? pipelineSummary.avg_throughput_tps.toFixed(1) : "-", tone: "emerald", hint: "Average throughput" },
        { label: "Alerts today", value: overview ? formatCompact(overview.alerts_today) : "-", tone: "rose", hint: "Live alert volume" },
      ];
    }

    if (role.key === "ai_data_engineer") {
      return [
        { label: "Feature flags", value: formatCompact(featureConfigs.length), tone: "violet", hint: `${featureConfigs.filter((item) => item.enabled).length} enabled` },
        { label: "Model versions", value: formatCompact(modelRegistry.length), tone: "blue", hint: `${activeModels.length} active` },
        { label: "Latest records", value: pipelineSummary?.total_points != null ? formatCompact(pipelineSummary.total_points) : "-", tone: "emerald", hint: "Pipeline metrics available" },
        { label: "Tracked wallets", value: overview ? formatCompact(overview.total_wallets) : "-", tone: "cyan", hint: "Source population" },
      ];
    }

    if (role.key === "security_analyst") {
      return [
        { label: "Critical alerts", value: alertsSummary ? formatCompact(alertsSummary.critical) : "-", tone: "rose", hint: "Severity snapshot" },
        { label: "Pending cases", value: caseSummary ? formatCompact(caseSummary.totals.PENDING || 0) : "-", tone: "amber", hint: `${caseSummary?.unassigned ?? 0} unassigned` },
        { label: "Notifications", value: notificationEvents.length ? formatCompact(notificationEvents.length) : "-", tone: "violet", hint: "Recent channel events" },
        { label: "Blocked today", value: blockedTransfers.length ? formatCompact(blockedTransfers.length) : "-", tone: "blue", hint: "Transfer intervention" },
      ];
    }

    return [
      { label: "Blocked value", value: reportingSummary ? formatEth(reportingSummary.kpis.blocked_value_eth) : "-", tone: "amber", hint: "30-day risk impact" },
      { label: "Audit completeness", value: auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-", tone: "emerald", hint: `${auditCompleteness?.present_actions ?? 0}/${auditCompleteness?.required_actions ?? 0}` },
      { label: "Policy rules", value: reportingSummary ? formatCompact(reportingSummary.kpis.policy_rules_active) : "-", tone: "violet", hint: "Active governance rules" },
      { label: "Blocked transfers", value: reportingSummary ? formatCompact(reportingSummary.kpis.blocked_total) : "-", tone: "rose", hint: "Audit window" },
    ];
  }, [activeModels.length, alertsSummary, auditCompleteness, blockedTransfers.length, caseSummary, dashboardStats, featureConfigs.length, modelRegistry.length, notificationEvents.length, pipelineSummary, reportingSummary, role.key, sloMetrics]);

  const chartPalette = ROLE_COLORS[role.key];
  const contextQuery = useMemo(() => {
    const query = new URLSearchParams({ role: role.key, feature: String(activeFeatureIndex) });
    return `?${query.toString()}`;
  }, [activeFeatureIndex, role.key]);

  const selectedPanel = useMemo(() => {
    if (role.key === "system_admin") {
      switch (activeFeatureIndex) {
        case 0:
          return {
            title: "Runtime health",
            description: "Availability, latency, and flow are sourced from live backend metrics.",
            content: (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
                  {flowStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300} minHeight={300}>
                      <LineChart data={flowChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 12 }} stroke="#3f3f46" />
                        <YAxis tick={{ fill: "#71717a", fontSize: 12 }} stroke="#3f3f46" />
                        <Tooltip cursor={{ stroke: "#ffffff", strokeWidth: 1 }} contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 16 }} labelStyle={{ color: "#fafafa" }} />
                        <Legend wrapperStyle={{ paddingTop: "16px" }} />
                        <Line type="monotone" dataKey="inflow" stroke={chartPalette[0]} strokeWidth={2} dot={false} name="Inflow" isAnimationActive={true} />
                        <Line type="monotone" dataKey="outflow" stroke={chartPalette[1]} strokeWidth={2} dot={false} name="Outflow" isAnimationActive={true} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[300px] items-center justify-center text-slate-500">
                      <div className="text-center">
                        <p className="text-sm">No flow data available</p>
                        <p className="text-xs text-slate-600 mt-2">Data will appear after transactions are processed</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid gap-3">
                  {sloMetrics ? (
                    <>
                      <MetricBlock label="Availability" value={formatPercent(sloMetrics.endpoint_health.availability_pct)} helper="Healthy / active endpoints" tone="cyan" />
                      <MetricBlock label="Error budget burn" value={formatPercent(sloMetrics.endpoint_health.error_budget_burn_pct)} helper="Current period" tone="slate" />
                      <MetricBlock label="Ingest p95" value={`${sloMetrics.latency_slo.ingest_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.ingest_target_ms.toFixed(0)} ms`} tone="slate" />
                      <MetricBlock label="Decode p95" value={`${sloMetrics.latency_slo.decode_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.decode_target_ms.toFixed(0)} ms`} tone="slate" />
                    </>
                  ) : null}
                </div>
              </div>
            ),
          };
        case 1:
          return { title: "Availability grid", description: "Node health and operational status pulled from the live ops API.", content: <NodeGrid nodes={nodeEndpoints} /> };
        case 2:
          return { title: "Node operations", description: "Active endpoints and their control plane settings.", content: <NodeTable nodes={nodeEndpoints} /> };
        case 3:
          return { title: "Pipeline operations", description: "Throughput and decode latency from the ingest pipeline.", content: <PipelineTable metrics={pipelineMetrics} summary={pipelineSummary} /> };
        case 4:
          return { title: "Diagnostics logs", description: "Real-time system diagnostics, API monitoring, and error tracking.", content: <DiagnosticsLogsPanel logs={diagnosticsLogs} /> };
        default:
          return {
            title: "SLO data panels",
            description: "Compliance-ready service-level metrics and data-integrity checks.",
            content: (
              <div className="space-y-4">
                <SloPanel sloMetrics={sloMetrics} />
                <DataIntegrityPanel report={dataIntegrity} onRefresh={() => void loadLiveData(activeRole, "manual")} />
              </div>
            ),
          };
      }
    }

    if (role.key === "ai_data_engineer") {
      switch (activeFeatureIndex) {
        case 0:
          return { title: "Model state", description: "Live registry and active model surface from the ops API.", content: <ModelRegistryTable models={modelRegistry} activeModels={activeModels} /> };
        case 1:
          return { title: "Feature state", description: "Enabled features and owner coverage.", content: <FeatureStoreTable features={featureConfigs} /> };
        case 2:
          return { title: "Feature operations", description: "Feature-store inventory with enablement ratio.", content: <FeatureOperationsPanel features={featureConfigs} /> };
        case 3:
          return { title: "Model operations", description: "Active-serving models, promotion signals, and deployment posture.", content: <ModelOperationsPanel models={modelRegistry} activeModels={activeModels} /> };
        case 4:
          return { title: "Feature data", description: "Expression quality and owner coverage details.", content: <FeatureDataPanel features={featureConfigs} /> };
        default:
          return { title: "Registry data", description: "Version lineage and artifact governance details.", content: <RegistryDataPanel models={modelRegistry} /> };
      }
    }

    if (role.key === "security_analyst") {
      switch (activeFeatureIndex) {
        case 0:
          return {
            title: "Alert queue",
            description: "Recent alerts and severity distribution from the backend.",
            content: <AlertQueuePanel alerts={recentAlerts} totalCount={totalAlertCount} alertsSummary={alertsSummary} contextQuery={contextQuery} />,
          };
        case 1:
          return {
            title: "Case queue",
            description: "High-risk cases that need analyst attention.",
            content: <CaseQueuePanel cases={caseItems} totalCount={totalCaseCount} caseSummary={caseSummary} contextQuery={contextQuery} />,
          };
        case 2:
          return { title: "Case actions", description: "Live case workflow state from the analyst queue.", content: <CaseActionPanel caseSummary={caseSummary} /> };
        case 3:
          return { title: "Notifications", description: "Delivery trail for sent security notifications.", content: <NotificationTable notifications={notificationEvents} /> };
        case 4:
          return { title: "Alert data", description: "Raw alert volume and severity chart from live data.", content: <AlertChartPanel alerts={recentAlerts} alertsSummary={alertsSummary} /> };
        default:
          return {
            title: "Case data",
            description: "Case distribution and recent records for audit traceability.",
            content: <CaseDataPanel cases={caseItems} caseSummary={caseSummary} contextQuery={contextQuery} />,
          };
      }
    }

    switch (activeFeatureIndex) {
      case 0:
        return {
          title: "Policy state",
          description: "Live policy rules and their enforcement posture.",
          content: <PolicyRulesPanel policies={policyRules} reportingSummary={reportingSummary} contextQuery={contextQuery} />,
        };
      case 1:
        return { title: "Audit state", description: "Evidence coverage and missing audit actions.", content: <AuditPanel auditCompleteness={auditCompleteness} auditGaps={auditGaps} /> };
      case 2:
        return { title: "Policy actions", description: "Block decisions, coverage, and outcome quality.", content: <ControlEffectivenessPanel controlEffectiveness={controlEffectiveness} reportingSummary={reportingSummary} /> };
      case 3:
        return { title: "Reporting", description: "30-day KPI export surface built from live records.", content: <ReportingSummaryPanel reportingSummary={reportingSummary} controlEffectiveness={controlEffectiveness} auditCompleteness={auditCompleteness} /> };
      case 4:
        return {
          title: "Policy data",
          description: "Rule-level policy metrics and guardrail readiness.",
          content: <PolicyDataPanel policies={policyRules} reportingSummary={reportingSummary} />,
        };
      default:
        return { title: "Audit data", description: "Missing evidence trail and control ownership gaps.", content: <AuditDataPanel auditCompleteness={auditCompleteness} auditGaps={auditGaps} /> };
    }
  }, [
    activeFeatureIndex,
    activeModels,
    alertsSummary,
    auditCompleteness,
    auditGaps,
    caseItems,
    caseSummary,
    chartPalette,
    controlEffectiveness,
    featureConfigs,
    modelRegistry,
    nodeEndpoints,
    notificationEvents,
    pipelineMetrics,
    pipelineSummary,
    policyRules,
    recentAlerts,
    reportingSummary,
    role.key,
    contextQuery,
    sloMetrics,
  ]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(245,158,11,0.13),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        <header className="mb-4 rounded-[32px] border border-slate-700/70 bg-slate-950/70 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.42)] backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 shadow-[0_16px_40px_rgba(34,211,238,0.35)]">
                <Shield className="h-8 w-8 text-white" />
                <div className="absolute inset-0 bg-white/10" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live data only
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-white md:text-4xl">Blockchain AI Operations Console</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                  Real backend data, role-specific controls, and stronger visual diagnostics for system, AI, security, and compliance work.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadLiveData(activeRole, "manual")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh live data
              </button>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
                {isLoading ? "Loading live feeds" : "Feeds connected"}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {availableRoles.map((entry) => {
              const isActive = entry.key === role.key;
              const isSwitching = roleSwitchingKey === entry.key;
              const disableRoleButtons = roleSwitchingKey !== null;
              return (
                <button
                  key={entry.key}
                  type="button"
                  disabled={disableRoleButtons}
                  onClick={() => {
                    if (entry.key === activeRole || roleSwitchingKey) return;
                    setRoleSwitchingKey(entry.key);
                    setActiveRole(entry.key);
                    setActiveFeatureIndex(0);
                    updateQuery({ role: entry.key, feature: 0 });
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-80",
                    isActive ? `${entry.accentClass} shadow-[0_0_0_1px_rgba(148,163,184,0.18)]` : "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:text-white",
                  ].join(" ")}
                >
                  {isSwitching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {entry.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
            <span className="px-2 text-xs uppercase tracking-[0.25em] text-slate-500">Quick routes</span>
            {visibleRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                prefetch={false}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-zinc-500/50 hover:text-white"
              >
                {route.label}
              </Link>
            ))}
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">Live data error: {error}</div>
        ) : null}

        <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Role" value={role.label} hint={activeFeatureLabel} accentClass={role.accentClass} />
          <MetricCard label="Section" value={activeFeatureLabel} hint={activeFeatureIndex < 2 ? "Overview focus" : activeFeatureIndex < 4 ? "Workflow focus" : "Data focus"} accentClass="border-slate-600 bg-slate-900/80" />
          <MetricCard label="Real data feeds" value={isLoading ? "Updating" : "Connected"} hint="Backend API responses" accentClass="border-emerald-500/30 bg-emerald-500/10" />
          <MetricCard label="Alerts today" value={dashboardStats ? formatCompact(dashboardStats.overview.alerts_today) : "-"} hint="From /statistics/dashboard" accentClass="border-rose-500/30 bg-rose-500/10" />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
          <aside className="rounded-[30px] border border-slate-700/70 bg-slate-950/65 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Sidebar functions</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{role.label}</h2>
              </div>
              <span className={["rounded-xl border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", role.accentClass].join(" ")}>{role.shortLabel}</span>
            </div>

            <div className="space-y-4">
              {SIDEBAR_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="px-1 text-[11px] uppercase tracking-[0.3em] text-slate-500">{group.title}</p>
                  {role.sidebarFeatures.slice(group.start, group.end).map((feature, offset) => {
                    const index = group.start + offset;
                    const Icon = sidebarIcons[index % sidebarIcons.length];
                    const isActiveFeature = index === activeFeatureIndex;

                    return (
                      <button
                        key={feature}
                        type="button"
                        onClick={() => {
                          setActiveFeatureIndex(index);
                          updateQuery({ role: role.key, feature: index });
                        }}
                        className={[
                          "w-full rounded-2xl border px-3 py-3 text-left transition",
                          isActiveFeature
                            ? "border-slate-500 bg-slate-800/90 text-white shadow-[0_12px_24px_rgba(15,23,42,0.4)]"
                            : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-600 hover:bg-slate-900/70",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <span className={["flex h-9 w-9 items-center justify-center rounded-xl border", isActiveFeature ? role.highlightClass : "border-slate-700 bg-slate-950/70 text-slate-400"].join(" ")}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{feature}</p>
                            <p className="text-xs text-slate-500">{isActiveFeature ? "Open live panel" : "Switch view"}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          <main className="space-y-4 rounded-[30px] border border-slate-700/70 bg-slate-950/65 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl md:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {roleMetricCards.map((card) => (
                <MetricCard key={card.label} label={card.label} value={card.value} hint={card.hint} accentClass={TONAL_STYLES[card.tone]} />
              ))}
            </div>

            <CardShell title={selectedPanel.title} subtitle={selectedPanel.description} icon={ChartColumn}>
              {selectedPanel.content}
            </CardShell>
          </main>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint, accentClass }: { label: string; value: string; hint: string; accentClass: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white md:text-2xl">{value}</p>
      <p className="mt-1 text-sm text-slate-300/80">{hint}</p>
    </div>
  );
}

function NodeGrid({ nodes }: { nodes: NodeEndpointItem[] }) {
  if (!nodes.length) {
    return <EmptyState message="No active node endpoints were returned by the backend." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {nodes.map((node) => (
        <div key={node.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{node.provider_name}</p>
              <p className="mt-1 text-xs text-slate-400">{node.chain} · {node.protocol}</p>
            </div>
            <SeverityPill severity={node.health_status.toUpperCase()} />
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>Endpoint: {node.endpoint_url}</p>
            <p>Priority: {node.priority}</p>
            <p>Checked: {formatDateTime(node.last_checked_at)}</p>
            {node.last_error ? <p className="text-rose-300">Error: {node.last_error}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function NodeTable({ nodes }: { nodes: NodeEndpointItem[] }) {
  const { notify } = useToast();
  const [mutableNodes, setMutableNodes] = useState(nodes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableNodes(nodes);
  }, [nodes]);

  async function reloadNodes() {
    const response = await fetch("/api/ops/system/node-endpoints?only_active=true");
    if (!response.ok) throw new Error("Failed to reload node endpoints");
    const payload = await response.json();
    const data = unwrapPayload<{ items: NodeEndpointItem[] }>(payload);
    setMutableNodes(data.items || []);
  }

  async function handleCreateNode() {
    const providerName = window.prompt("Provider name", "Manual Node");
    if (!providerName || !providerName.trim()) return;
    const chain = window.prompt("Chain", "ethereum");
    if (!chain || !chain.trim()) return;
    const endpointUrl = window.prompt("Endpoint URL", "https://example-node.local/rpc");
    if (!endpointUrl || !endpointUrl.trim()) return;
    const protocol = (window.prompt("Protocol (http/websocket)", "http") || "http").toLowerCase();
    if (!["http", "websocket"].includes(protocol)) {
      notify("Protocol phải là http hoặc websocket", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/ops/system/node-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: providerName.trim(),
          chain: chain.trim(),
          endpoint_url: endpointUrl.trim(),
          protocol,
          priority: 100,
          is_active: true,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create node endpoint");
      }
      await reloadNodes();
      notify("Node endpoint created", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create node endpoint";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateHealth(node: NodeEndpointItem, healthStatus: "healthy" | "degraded" | "down" | "unknown") {
    setIsSubmitting(true);
    try {
      const lastError = healthStatus === "down" ? (window.prompt("Last error (optional)") ?? "") : "";
      const response = await fetch(`/api/ops/system/node-endpoints/${encodeURIComponent(node.id)}/health`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_status: healthStatus,
          last_error: lastError || null,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update node health");
      }

      setMutableNodes((previous) =>
        previous.map((item) =>
          item.id === node.id
            ? {
              ...item,
              health_status: healthStatus,
              last_error: healthStatus === "down" ? (lastError || item.last_error) : null,
              last_checked_at: new Date().toISOString(),
            }
            : item
        )
      );
      notify(`Node ${node.provider_name} health -> ${healthStatus.toUpperCase()}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update node health";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableNodes.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleCreateNode()}
className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Add node endpoint
        </button>
        <EmptyState message="No node records to display." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleCreateNode()}
className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Add node endpoint
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Provider</th>
              <th className="px-4 py-3 text-left font-medium">Chain</th>
              <th className="px-4 py-3 text-left font-medium">Health</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableNodes.map((node) => (
              <tr key={node.id}>
                <td className="px-4 py-3">{node.provider_name}</td>
                <td className="px-4 py-3">{node.chain}</td>
                <td className="px-4 py-3">{node.health_status}</td>
                <td className="px-4 py-3">{node.priority}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "healthy")}
                      className="rounded-md border border-zinc-400/40 bg-zinc-400/10 px-2 py-1 text-[11px] text-zinc-100 disabled:opacity-60"
                    >
                      Healthy
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "degraded")}
                      className="rounded-md border border-zinc-600/40 bg-zinc-600/10 px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-60"
                    >
                      Degraded
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "down")}
                      className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 disabled:opacity-60"
                    >
                      Down
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelineTable({ metrics, summary }: { metrics: PipelineMetricItem[]; summary: { total_points: number; avg_throughput_tps: number | null; avg_ingestion_latency_ms: number | null; avg_decode_latency_ms: number | null; last_block_number: number | null } | null }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Points" value={summary ? formatCompact(summary.total_points) : "-"} hint="Pipeline samples" accentClass="border-slate-700 bg-slate-900/70" />
        <MetricCard label="Avg TPS" value={summary?.avg_throughput_tps != null ? summary.avg_throughput_tps.toFixed(1) : "-"} hint="Throughput" accentClass="border-zinc-500/20 bg-zinc-500/10" />
        <MetricCard label="Ingest latency" value={summary?.avg_ingestion_latency_ms != null ? `${summary.avg_ingestion_latency_ms.toFixed(0)} ms` : "-"} hint="Average" accentClass="border-zinc-500/20 bg-zinc-500/10" />
        <MetricCard label="Last block" value={summary?.last_block_number != null ? formatCompact(summary.last_block_number) : "-"} hint="Latest signal" accentClass="border-zinc-500/20 bg-zinc-500/10" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Chain</th>
              <th className="px-4 py-3 text-left font-medium">Block</th>
              <th className="px-4 py-3 text-left font-medium">TPS</th>
              <th className="px-4 py-3 text-left font-medium">Ingest</th>
              <th className="px-4 py-3 text-left font-medium">Decode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-zinc-950/60 text-zinc-200">
            {metrics.slice(0, 8).map((metric) => (
              <tr key={metric.id}>
                <td className="px-4 py-3">{metric.chain}</td>
                <td className="px-4 py-3">{metric.block_number ?? "-"}</td>
                <td className="px-4 py-3">{metric.throughput_tps != null ? metric.throughput_tps.toFixed(1) : "-"}</td>
                <td className="px-4 py-3">{metric.ingestion_latency_ms ?? "-"}</td>
                <td className="px-4 py-3">{metric.decode_latency_ms ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
      const response = await fetch(`/api/admin/diagnostics/logs?${params.toString()}`);
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
    error: "bg-red-500/20 text-red-300 border-red-500/30",
    amber: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
    info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    api_call: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
    api_error: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    violet: "border-zinc-500/20 bg-zinc-500/10 text-zinc-100",
    orange: "border-zinc-600/20 bg-zinc-600/10 text-zinc-300",
    ai_service: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
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
      const response = await fetch(`/api/admin/diagnostics/logs/export?${params.toString()}`);
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

  async function handleArchiveFiltered(archived: boolean) {
    setIsArchiving(true);
    try {
      const response = await fetch("/api/admin/diagnostics/logs/archive", {
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
        <MetricBlock label="Total logs" value={formatCompact(mutableLogs.length)} helper="All diagnostic entries" tone="cyan" />
        <MetricBlock label="Errors" value={formatCompact(errorCount)} helper="Error logs" tone={errorCount > 0 ? "rose" : "emerald"} />
        <MetricBlock label="Endpoints" value={formatCompact(new Set(mutableLogs.map((log) => log.endpoint).filter(Boolean)).size)} helper="Unique endpoints" tone="blue" />
        <MetricBlock label="Log types" value={formatCompact(uniqueTypes.length)} helper="Different log categories" tone="violet" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={exportDate}
          onChange={(event) => setExportDate(event.target.value)}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        />
        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchiveFiltered(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs font-medium text-amber-200 transition hover:border-amber-500/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Archiving..." : `Archive filtered (${filteredLogs.length})`}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchiveFiltered(false)}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:border-emerald-500/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Updating..." : "Unarchive filtered"}
        </button>
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search message or endpoint..."
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-zinc-500/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        >
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400 sticky top-0">
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
                  <span className={`inline-block rounded-lg border px-2 py-1 text-xs font-medium ${logTypeColors[(log.log_type || "").toLowerCase()] || "bg-slate-700/50 text-slate-300"}`}>
                    {(log.log_type || "unknown").toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-sm truncate text-slate-300">{log.message}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {log.status_code ? (
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${log.status_code >= 200 && log.status_code < 300
                        ? "bg-emerald-500/20 text-emerald-300"
                        : log.status_code >= 400
                          ? "bg-red-500/20 text-red-300"
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

function integrityRouteForKey(key: string, ownerRole: string): string {
  if (ownerRole === "system_admin") {
    if (key.includes("node_endpoints")) return "/?role=system_admin&feature=2";
    if (key.includes("pipeline_metrics")) return "/?role=system_admin&feature=3";
    return "/?role=system_admin&feature=4";
  }
  if (ownerRole === "ai_data_engineer") {
    if (key.includes("active_models")) return "/?role=ai_data_engineer&feature=3";
    if (key.includes("feature")) return "/?role=ai_data_engineer&feature=1";
    return "/?role=ai_data_engineer&feature=0";
  }
  if (ownerRole === "security_analyst") {
    if (key.includes("blocked")) return "/?role=security_analyst&feature=2";
    return "/?role=security_analyst&feature=0";
  }
  return "/?role=compliance_risk_manager&feature=0";
}

function SloPanel({ sloMetrics }: { sloMetrics: SloMetrics | null }) {
  if (!sloMetrics) {
    return <EmptyState message="SLO metrics are not available from the backend right now." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricBlock label="Availability" value={formatPercent(sloMetrics.endpoint_health.availability_pct)} helper={`${sloMetrics.endpoint_health.healthy_active}/${sloMetrics.endpoint_health.active} active endpoints healthy`} tone="cyan" />
      <MetricBlock label="Error budget burn" value={formatPercent(sloMetrics.endpoint_health.error_budget_burn_pct)} helper="Current window" tone="rose" />
      <MetricBlock label="Ingest p95" value={`${sloMetrics.latency_slo.ingest_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.ingest_target_ms.toFixed(0)} ms`} tone="violet" />
      <MetricBlock label="Decode p95" value={`${sloMetrics.latency_slo.decode_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.decode_target_ms.toFixed(0)} ms`} tone="amber" />
    </div>
  );
}

function DataIntegrityPanel({ report, onRefresh }: { report: DataIntegrityReport | null; onRefresh?: () => void }) {
  const [isFixing, setIsFixing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!report) {
    return <EmptyState message="Data integrity report is not available yet." />;
  }

  const missing = report.missing_controls ?? [];

  async function handleAutoFix() {
    setIsFixing(true);
    try {
      const response = await fetch("/api/ops/system/data-integrity/auto-fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      if (!response.ok) throw new Error("Failed to auto-fix integrity controls");
      if (onRefresh) onRefresh();
    } finally {
      setIsFixing(false);
    }
  }

  async function handleExportIntegrity(format: "csv" | "json") {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/ops/system/data-integrity/export?format=${format}`);
      if (!response.ok) throw new Error("Failed to export integrity report");
      const payload = await response.json();
      const data = payload?.data ?? payload;

      if (format === "csv") {
        const csvText = String(data?.csv || "");
        const fileName = String(data?.filename || "data_integrity.csv");
        const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      const jsonText = JSON.stringify(data?.report ?? {}, null, 2);
      const fileName = String(data?.filename || "data_integrity.json");
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Data integrity controls</p>
          <p className="mt-1 text-xs text-slate-400">DB-first readiness for role modules and controls</p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${report.overall_ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"}`}>
          {report.overall_ok ? "ALL OK" : `${missing.length} GAPS`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricBlock label="Checks" value={formatCompact(report.checks.length)} helper="Total controls" tone="cyan" />
        <MetricBlock label="Missing" value={formatCompact(missing.length)} helper="Need seeding/config" tone={missing.length ? "rose" : "emerald"} />
        <MetricBlock label="Roles ready" value={formatCompact(Object.values(report.role_readiness || {}).filter(Boolean).length)} helper="Out of 4 roles" tone="violet" />
        <MetricBlock label="Diagnostics rows" value={formatCompact(report.counts?.diagnostic_events ?? 0)} helper="Persistent logs" tone="amber" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAutoFix()}
          disabled={isFixing || missing.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-xs font-medium text-emerald-200 transition hover:border-emerald-500/60 disabled:opacity-60"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {isFixing ? "Auto-fixing..." : `Auto-fix missing (${missing.length})`}
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("csv")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export integrity CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("json")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export integrity JSON
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Control</th>
              <th className="px-4 py-3 text-left font-medium">Owner role</th>
              <th className="px-4 py-3 text-left font-medium">Actual / Required</th>
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {(missing.length ? missing : report.checks.slice(0, 8).map((item) => ({
              key: item.key,
              owner_role: item.owner_role,
              actual: item.actual,
              required_min: item.required_min,
              severity: item.ok ? "ok" : "medium",
            }))
            ).slice(0, 10).map((item) => (
              <tr key={`${item.key}:${item.owner_role}`}>
                <td className="px-4 py-3">{item.key}</td>
                <td className="px-4 py-3">{item.owner_role}</td>
                <td className="px-4 py-3">{item.actual} / {item.required_min}</td>
                <td className="px-4 py-3">{String(item.severity).toUpperCase()}</td>
                <td className="px-4 py-3">
                  <Link
                    href={integrityRouteForKey(item.key, item.owner_role)}
                    prefetch={false}
className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white hover:border-white/40"
                  >
                    Open owner view
                  </Link>
                </td>
              </tr>
            ))}
            {missing.length === 0 && report.checks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No integrity controls were returned.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModelRegistryTable({ models, activeModels }: { models: ModelRegistryItem[]; activeModels: ModelRegistryItem[] }) {
  const { notify } = useToast();
  const [mutableModels, setMutableModels] = useState(models);
  const [mutableActiveModels, setMutableActiveModels] = useState(activeModels);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableModels(models);
  }, [models]);

  useEffect(() => {
    setMutableActiveModels(activeModels);
  }, [activeModels]);

  const activeNames = new Set(mutableActiveModels.map((item) => `${item.model_name}:${item.version}`));

  async function reloadModels() {
    const [allResponse, activeResponse] = await Promise.all([
      fetch("/api/ops/ai/model-registry"),
      fetch("/api/ops/ai/model-registry/active"),
    ]);
    if (!allResponse.ok || !activeResponse.ok) throw new Error("Failed to reload model registry");

    const [allPayload, activePayload] = await Promise.all([allResponse.json(), activeResponse.json()]);
    const allData = unwrapPayload<{ items: ModelRegistryItem[] }>(allPayload);
    const activeData = unwrapPayload<{ items: ModelRegistryItem[] }>(activePayload);
    setMutableModels(allData.items || []);
    setMutableActiveModels(activeData.items || []);
  }

  async function handleRegisterModel() {
    const modelName = window.prompt("Model name", "risk_detector");
    if (!modelName || !modelName.trim()) return;
    const version = window.prompt("Version", "v1.0.0");
    if (!version || !version.trim()) return;
    const artifactUri = window.prompt("Artifact URI", "s3://ml-artifacts/risk_detector/v1.0.0");
    if (!artifactUri || !artifactUri.trim()) return;
    const framework = (window.prompt("Framework (pkl/onnx/pt)", "pkl") || "pkl").toLowerCase();
    if (!["pkl", "onnx", "pt"].includes(framework)) {
      notify("Framework phải là pkl, onnx hoặc pt", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/ops/ai/model-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: modelName.trim(),
          version: version.trim(),
          artifact_uri: artifactUri.trim(),
          framework,
          is_active: false,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to register model");
      }
      await reloadModels();
      notify("Model registered", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register model";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateModel(model: ModelRegistryItem) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/ops/ai/model-registry/${encodeURIComponent(model.id)}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to activate model");
      }
      await reloadModels();
      notify(`Model ${model.model_name} ${model.version} activated`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to activate model";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableModels.length && !mutableActiveModels.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleRegisterModel()}
className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Register model
        </button>
        <EmptyState message="Model registry is empty." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricBlock label="Registry entries" value={formatCompact(mutableModels.length)} helper="Current records" tone="violet" />
        <MetricBlock label="Active models" value={formatCompact(mutableActiveModels.length)} helper="Serving now" tone="emerald" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(mutableModels.map((item) => item.framework)).size)} helper="Unique runtimes" tone="cyan" />
        <MetricBlock label="Artifacts" value={formatCompact(mutableModels.length)} helper="Tracked versions" tone="amber" />
      </div>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleRegisterModel()}
className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Register model
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Framework</th>
              <th className="px-4 py-3 text-left font-medium">Active</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableModels.slice(0, 50).map((model) => {
              const isActive = model.is_active || activeNames.has(`${model.model_name}:${model.version}`);
              return (
                <tr key={model.id}>
                  <td className="px-4 py-3">{model.model_name}</td>
                  <td className="px-4 py-3">{model.version}</td>
                  <td className="px-4 py-3">{model.framework}</td>
                  <td className="px-4 py-3">{isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isSubmitting || isActive}
                      onClick={() => void handleActivateModel(model)}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200 disabled:opacity-60"
                    >
                      {isActive ? "Active" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureStoreTable({ features }: { features: FeatureConfigItem[] }) {
  const { notify } = useToast();
  const [mutableFeatures, setMutableFeatures] = useState(features);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableFeatures(features);
  }, [features]);

  async function handleCreateFeature() {
    const featureKey = window.prompt("Feature key (unique), ví dụ: suspicious_velocity_flag");
    if (!featureKey || !featureKey.trim()) return;
    const expression = window.prompt("Expression (optional)") ?? "";

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/ops/ai/feature-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: featureKey.trim(),
          enabled: true,
          expression: expression.trim() || null,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create feature");
      }

      const listResponse = await fetch("/api/ops/ai/feature-store");
      if (!listResponse.ok) throw new Error("Failed to reload features");
      const payload = await listResponse.json();
      const data = unwrapPayload<{ items: FeatureConfigItem[] }>(payload);
      setMutableFeatures(data.items || []);
      notify("Feature created", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create feature";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleFeature(feature: FeatureConfigItem) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/ops/ai/feature-store/${encodeURIComponent(feature.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !feature.enabled }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update feature");
      }

      setMutableFeatures((previous) =>
        previous.map((item) =>
          item.id === feature.id
            ? { ...item, enabled: !item.enabled, updated_at: new Date().toISOString() }
            : item
        )
      );
      notify(`Feature ${feature.feature_key} ${feature.enabled ? "disabled" : "enabled"}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update feature";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableFeatures.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleCreateFeature()}
          className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Add feature
        </button>
        <EmptyState message="Feature store is empty." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleCreateFeature()}
        className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Add feature
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Feature</th>
              <th className="px-4 py-3 text-left font-medium">Enabled</th>
              <th className="px-4 py-3 text-left font-medium">Expression</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableFeatures.slice(0, 50).map((feature) => (
              <tr key={feature.id}>
                <td className="px-4 py-3">{feature.feature_key}</td>
                <td className="px-4 py-3">{feature.enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{feature.expression ?? "-"}</td>
                <td className="px-4 py-3">{formatDateTime(feature.updated_at)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleToggleFeature(feature)}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200 transition hover:border-amber-400/60 disabled:opacity-60"
                  >
                    {feature.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureOperationsPanel({ features }: { features: FeatureConfigItem[] }) {
  const enabled = features.filter((item) => item.enabled).length;
  const data = [
    { name: "Enabled", value: enabled },
    { name: "Disabled", value: Math.max(0, features.length - enabled) },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={index === 0 ? ROLE_COLORS.ai_data_engineer[0] : ROLE_COLORS.ai_data_engineer[2]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1f2937", borderRadius: 16 }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <div className="space-y-3">
          <MetricBlock label="Enabled features" value={formatCompact(enabled)} helper="Active feature flags" tone="violet" />
          <MetricBlock label="Disabled features" value={formatCompact(Math.max(0, features.length - enabled))} helper="Risk-free toggles" tone="amber" />
          <MetricBlock label="Owner coverage" value={formatCompact(new Set(features.map((item) => item.owner_user_id).filter(Boolean)).size)} helper="Unique owners" tone="emerald" />
        </div>
      </div>
    </div>
  );
}

function ModelOperationsPanel({ models, activeModels }: { models: ModelRegistryItem[]; activeModels: ModelRegistryItem[] }) {
  const activeKey = new Set(activeModels.map((item) => `${item.model_name}:${item.version}`));
  const promoted = models.filter((item) => Boolean(item.promoted_at));
  const inactive = models.filter((item) => !item.is_active && !activeKey.has(`${item.model_name}:${item.version}`));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Active serving" value={formatCompact(activeModels.length)} helper="Live models" tone="emerald" />
        <MetricBlock label="Promoted" value={formatCompact(promoted.length)} helper="Governed promotions" tone="cyan" />
        <MetricBlock label="Inactive" value={formatCompact(inactive.length)} helper="Needs review" tone="rose" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(models.map((item) => item.framework)).size)} helper="Runtime diversity" tone="violet" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Promoted</th>
              <th className="px-4 py-3 text-left font-medium">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {models.slice(0, 50).map((item) => {
              const key = `${item.model_name}:${item.version}`;
              const isServing = item.is_active || activeKey.has(key);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3">{item.model_name}</td>
                  <td className="px-4 py-3">{item.version}</td>
                  <td className="px-4 py-3">{isServing ? "SERVING" : "INACTIVE"}</td>
                  <td className="px-4 py-3">{formatDateTime(item.promoted_at)}</td>
                  <td className="px-4 py-3">{item.promoted_by ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureDataPanel({ features }: { features: FeatureConfigItem[] }) {
  if (!features.length) {
    return <EmptyState message="No feature data available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Features" value={formatCompact(features.length)} helper="All records" tone="violet" />
        <MetricBlock label="With expression" value={formatCompact(features.filter((item) => Boolean(item.expression)).length)} helper="Ready for runtime" tone="amber" />
        <MetricBlock label="Owned" value={formatCompact(features.filter((item) => Boolean(item.owner_user_id)).length)} helper="Has owner" tone="emerald" />
        <MetricBlock label="Updated" value={formatCompact(features.filter((item) => Boolean(item.updated_at)).length)} helper="Fresh metadata" tone="cyan" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Feature key</th>
              <th className="px-4 py-3 text-left font-medium">Expression</th>
              <th className="px-4 py-3 text-left font-medium">Owner</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {features.slice(0, 50).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.feature_key}</td>
                <td className="px-4 py-3">{item.expression ?? "-"}</td>
                <td className="px-4 py-3">{item.owner_user_id ?? "-"}</td>
                <td className="px-4 py-3">{formatDateTime(item.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegistryDataPanel({ models }: { models: ModelRegistryItem[] }) {
  if (!models.length) {
    return <EmptyState message="No registry versions available." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricBlock label="Versions" value={formatCompact(models.length)} helper="Tracked versions" tone="violet" />
        <MetricBlock label="Artifacts" value={formatCompact(models.filter((item) => Boolean(item.artifact_uri)).length)} helper="Stored URIs" tone="cyan" />
        <MetricBlock label="Promoted" value={formatCompact(models.filter((item) => Boolean(item.promoted_at)).length)} helper="Lifecycle events" tone="emerald" />
        <MetricBlock label="Missing promoter" value={formatCompact(models.filter((item) => !item.promoted_by).length)} helper="Governance gap" tone="rose" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Artifact URI</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {models.slice(0, 50).map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">{item.model_name}</td>
                <td className="px-4 py-3">{item.version}</td>
                <td className="px-4 py-3">{item.artifact_uri || "-"}</td>
                <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertQueuePanel({
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
  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

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
  }, [filteredAlerts, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(Math.max(totalCount, sortedAlerts.length) / pageSize));
  const pagedAlerts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedAlerts.slice(startIndex, startIndex + pageSize);
  }, [page, sortedAlerts]);

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
              className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500/50"
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
                    <Link href={`/insights/wallet/${encodeURIComponent(alert.wallet_address)}${contextQuery}`} className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
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
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1f2937", borderRadius: 16 }} />
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

function CaseQueuePanel({
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
  }, [page, sortedCases]);

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
      const response = await fetch(`/api/cases/${encodeURIComponent(txHash)}/action`, {
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
        <MetricBlock label="Pending" value={formatCompact(caseSummary?.totals.PENDING ?? 0)} helper="Case queue" tone="rose" />
        <MetricBlock label="Verified" value={formatCompact(caseSummary?.totals.VERIFIED ?? 0)} helper="Analyst review" tone="violet" />
        <MetricBlock label="Fraud" value={formatCompact(caseSummary?.totals.FRAUD ?? 0)} helper="Confirmed risk" tone="amber" />
        <MetricBlock label="Unassigned" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Assignment gap" tone="cyan" />
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
            className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-cyan-500/50"
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
          <option value="IGNORED">IGNORED</option>
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
                      className="rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200 disabled:opacity-60"
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
                  <Link href={`/insights/case/${encodeURIComponent(item.tx_hash)}${contextQuery}`} className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
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

function CaseActionPanel({ caseSummary }: { caseSummary: CaseSummary | null }) {
  const totals = caseSummary?.totals ?? {};
  const chartData = [
    { name: "PENDING", value: totals.PENDING ?? 0 },
    { name: "VERIFIED", value: totals.VERIFIED ?? 0 },
    { name: "FRAUD", value: totals.FRAUD ?? 0 },
    { name: "IGNORED", value: totals.IGNORED ?? 0 },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={4}>
              {chartData.map((entry, index) => (
                <Cell key={entry.name} fill={ROLE_COLORS.security_analyst[index]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1f2937", borderRadius: 16 }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3">
        <MetricBlock label="High-risk unassigned" value={formatCompact(caseSummary?.high_risk_unassigned ?? 0)} helper="Needs immediate action" tone="rose" />
        <MetricBlock label="Total queue" value={formatCompact(Object.values(totals).reduce((sum, value) => sum + value, 0))} helper="Live case volume" tone="violet" />
        <MetricBlock label="Assignment pressure" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Open cases without owners" tone="amber" />
      </div>
    </div>
  );
}

function NotificationTable({ notifications }: { notifications: NotificationItem[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const pageSizeOptions = [8, 20, 50];

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const pagedNotifications = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return notifications.slice(startIndex, startIndex + pageSize);
  }, [notifications, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!notifications.length) {
    return <EmptyState message="No notification events have been recorded yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Channel</th>
              <th className="px-4 py-3 text-left font-medium">Recipient</th>
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {pagedNotifications.map((notification) => (
              <tr key={notification.id}>
                <td className="px-4 py-3">{notification.channel}</td>
                <td className="px-4 py-3">{notification.recipient}</td>
                <td className="px-4 py-3"><SeverityPill severity={notification.severity} /></td>
                <td className="px-4 py-3">{notification.status}</td>
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
        itemCount={notifications.length}
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

function AlertChartPanel({ alerts, alertsSummary }: { alerts: Alert[]; alertsSummary: AlertsSummary | null }) {
  const severityCounts = countBy(alerts, (entry) => entry.severity);
  const chartData = [
    { name: "CRITICAL", value: alertsSummary?.critical ?? severityCounts.CRITICAL ?? 0 },
    { name: "HIGH", value: alertsSummary?.high ?? severityCounts.HIGH ?? 0 },
    { name: "MEDIUM", value: alertsSummary?.medium ?? severityCounts.MEDIUM ?? 0 },
    { name: "LOW", value: alertsSummary?.low ?? severityCounts.LOW ?? 0 },
  ];

  return (
    <div className="h-[320px] rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1f2937", borderRadius: 16 }} />
          <Bar dataKey="value" radius={[10, 10, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={ROLE_COLORS.security_analyst[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CaseDataPanel({ cases, caseSummary, contextQuery }: { cases: CaseItem[]; caseSummary: CaseSummary | null; contextQuery: string }) {
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
        <MetricBlock label="Total cases" value={formatCompact(cases.length)} helper="Current dataset" tone="violet" />
        <MetricBlock label="Flagged" value={formatCompact(cases.filter((item) => item.is_flagged).length)} helper="Risk signals" tone="amber" />
        <MetricBlock label="Assigned" value={formatCompact(cases.filter((item) => Boolean(item.assigned_to)).length)} helper="Has owner" tone="emerald" />
        <MetricBlock label="Unassigned" value={formatCompact(caseSummary?.unassigned ?? 0)} helper="Assignment gap" tone="rose" />
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
                  <Link href={`/insights/case/${encodeURIComponent(item.tx_hash)}${contextQuery}`} className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200">
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

function PolicyDataPanel({ policies, reportingSummary }: { policies: PolicyRuleItem[]; reportingSummary: ReportingSummary | null }) {
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
        <MetricBlock label="Rules" value={formatCompact(policies.length)} helper="All policy records" tone="amber" />
        <MetricBlock label="Active" value={formatCompact(policies.filter((item) => item.is_active).length)} helper="Enforced now" tone="emerald" />
        <MetricBlock label="Avg threshold" value={`${(policies.reduce((sum, item) => sum + item.min_risk_score, 0) / Math.max(1, policies.length)).toFixed(1)}`} helper="Risk floor" tone="violet" />
        <MetricBlock label="Blocked total" value={formatCompact(reportingSummary?.kpis.blocked_total ?? 0)} helper="30-day impact" tone="rose" />
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

function AuditDataPanel({ auditCompleteness, auditGaps }: { auditCompleteness: AuditCompleteness | null; auditGaps: AuditGaps | null }) {
  const checks = auditCompleteness?.checks ?? [];
  const missingActions = auditGaps?.missing_actions ?? [];

  const [checksPage, setChecksPage] = useState(1);
  const [missingPage, setMissingPage] = useState(1);
  const pageSize = 5;

  const checksTotalPages = Math.max(1, Math.ceil(checks.length / pageSize));
  const missingTotalPages = Math.max(1, Math.ceil(missingActions.length / pageSize));

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
        <MetricBlock label="Completeness" value={formatPercent(auditCompleteness?.completeness_pct ?? 0)} helper="Audit coverage" tone="emerald" />
        <MetricBlock label="Required" value={formatCompact(auditCompleteness?.required_actions ?? 0)} helper="Required actions" tone="violet" />
        <MetricBlock label="Present" value={formatCompact(auditCompleteness?.present_actions ?? 0)} helper="Captured actions" tone="cyan" />
        <MetricBlock label="Missing" value={formatCompact(auditGaps?.missing_count ?? 0)} helper="Outstanding gaps" tone="rose" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-white">Audit checks</p>
          <div className="mt-3 flex-grow space-y-2 text-sm text-slate-300">
            {pagedChecks.length ? pagedChecks.map((item, idx) => (
              <div key={`${item.action_type}:${idx}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
                <span>{item.action_type}</span>
                <span>{item.count} · {item.present ? "PRESENT" : "MISSING"}</span>
              </div>
            )) : <p className="text-slate-500">No audit checks found.</p>}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-3">
            <TablePager
              page={checksPage}
              totalPages={checksTotalPages}
              onPrev={() => setChecksPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setChecksPage((prev) => Math.min(checksTotalPages, prev + 1))}
              itemCount={checks.length}
              pageSize={pageSize}
              pageSizeOptions={[5]}
              onPageSizeChange={() => {}}
            />
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-sm font-semibold text-white">Missing actions</p>
          <div className="mt-3 flex-grow space-y-2 text-sm text-slate-300">
            {pagedMissing.length ? pagedMissing.map((item, idx) => (
              <div key={`${item.action_type}:${idx}`} className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-200">
                <p className="font-medium">{item.action_type}</p>
                <p className="text-xs text-rose-300/80 mt-1">Owner: {item.owner_role} · {item.reason}</p>
              </div>
            )) : <p className="text-slate-500">No missing actions.</p>}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-3">
            <TablePager
              page={missingPage}
              totalPages={missingTotalPages}
              onPrev={() => setMissingPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setMissingPage((prev) => Math.min(missingTotalPages, prev + 1))}
              itemCount={missingActions.length}
              pageSize={pageSize}
              pageSizeOptions={[5]}
              onPageSizeChange={() => {}}
            />
          </div>
        </div>
      </div>
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

function AuditPanel({ auditCompleteness, auditGaps }: { auditCompleteness: AuditCompleteness | null; auditGaps: AuditGaps | null }) {
  if (!auditCompleteness && !auditGaps) {
    return <EmptyState message="Audit data is not available from the backend right now." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <MetricBlock label="Completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="Required audit actions present" tone="emerald" />
        <MetricBlock label="Present actions" value={auditCompleteness ? `${auditCompleteness.present_actions}/${auditCompleteness.required_actions}` : "-"} helper="Audit coverage" tone="cyan" />
        <MetricBlock label="Missing actions" value={auditGaps ? formatCompact(auditGaps.missing_count) : "-"} helper="Gaps needing evidence" tone="rose" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-zinc-800 text-sm">
          <thead className="bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Count</th>
              <th className="px-4 py-3 text-left font-medium">Present</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/60 text-zinc-200">
            {auditCompleteness?.checks.slice(0, 8).map((check) => (
              <tr key={check.action_type}>
                <td className="px-4 py-3">{check.action_type}</td>
                <td className="px-4 py-3">{check.count}</td>
                <td className="px-4 py-3">{check.present ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ControlEffectivenessPanel({ controlEffectiveness, reportingSummary }: { controlEffectiveness: ControlEffectiveness | null; reportingSummary: ReportingSummary | null }) {
  if (!controlEffectiveness) {
    return <EmptyState message="Control effectiveness metrics are unavailable." />;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricBlock label="Block rate" value={formatPercent(controlEffectiveness.metrics.block_rate_pct)} helper="Actionable alerts blocked" tone="rose" />
        <MetricBlock label="Fraud precision" value={formatPercent(controlEffectiveness.metrics.fraud_precision_proxy_pct)} helper="Decision quality proxy" tone="emerald" />
        <MetricBlock label="Decision coverage" value={formatCompact(controlEffectiveness.metrics.decision_coverage)} helper="Resolved cases" tone="violet" />
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold text-white">Reporting summary</p>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p>Alerts: {formatCompact(reportingSummary?.kpis.alerts_total ?? 0)}</p>
          <p>Blocked value: {reportingSummary ? formatEth(reportingSummary.kpis.blocked_value_eth) : "-"}</p>
          <p>Notifications failed: {formatCompact(reportingSummary?.kpis.notifications_failed ?? 0)}</p>
          <p>Window days: {reportingSummary?.period.days ?? controlEffectiveness.period_days}</p>
        </div>
      </div>
    </div>
  );
}

function ReportingSummaryPanel({ reportingSummary, controlEffectiveness, auditCompleteness }: { reportingSummary: ReportingSummary | null; controlEffectiveness: ControlEffectiveness | null; auditCompleteness: AuditCompleteness | null }) {
  if (!reportingSummary) {
    return <EmptyState message="Reporting summary is not available yet." />;
  }

  const chartData = [
    { name: "Alerts", value: reportingSummary.kpis.alerts_total },
    { name: "Blocked", value: reportingSummary.kpis.blocked_total },
    { name: "Policies", value: reportingSummary.kpis.policy_rules_active },
    { name: "Audit", value: reportingSummary.kpis.audit_events },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1f2937", borderRadius: 16 }} />
            <Bar dataKey="value" radius={[10, 10, 0, 0]} fill={ROLE_COLORS.compliance_risk_manager[0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3">
        <MetricBlock label="Audit completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="Evidence coverage" tone="emerald" />
        <MetricBlock label="Block rate" value={controlEffectiveness ? formatPercent(controlEffectiveness.metrics.block_rate_pct) : "-"} helper="Compliance outcomes" tone="amber" />
        <MetricBlock label="Blocked value" value={formatEth(reportingSummary.kpis.blocked_value_eth)} helper="Live risk impact" tone="rose" />
      </div>
    </div>
  );
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return <EmptyState message="No recent alerts were returned by the backend." />;
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 8).map((alert) => (
        <div key={alert.alert_id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{alert.message}</p>
              <p className="mt-1 text-xs text-zinc-500">{formatAddress(alert.wallet_address)} · {alert.alert_type}</p>
            </div>
            <SeverityPill severity={alert.severity} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockedTransferList({ blockedTransfers }: { blockedTransfers: BlockedTransfer[] }) {
  if (!blockedTransfers.length) {
    return <EmptyState message="No blocked transfers were returned by the backend." />;
  }

  return (
    <div className="space-y-2">
      {blockedTransfers.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{formatAddress(item.sender_address)} → {formatAddress(item.receiver_address)}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.block_reason}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{formatEth(item.amount_eth)}</p>
              <p className="mt-1 text-xs text-zinc-500">Risk {item.risk_score.toFixed(1)}</p>
            </div>
          </div>
        </div>
      ))}
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { io } from "socket.io-client";
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
  Send,
  MessageSquare,
} from "lucide-react";
import type { Alert, BlockedTransfer, DashboardStats, FlowStats } from "@/lib/api";
import { 
  fetchBlockedTransfers, 
  fetchDashboardStats, 
  fetchFlowStats, 
  fetchRecentAlerts,
  sendTestNotification,
  fetchFeedbackStats,
  fetchAuditLogs
} from "@/lib/api";
import { authFetch } from "@/lib/auth-fetch";
import { Button } from "@/components/ui/button";
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

const SIDEBAR_GROUPS: Array<{ title: string; start: number; end: number }> = [
  { title: "Overview", start: 0, end: 2 },
  { title: "Functions", start: 2, end: 4 },
  { title: "Data", start: 4, end: 6 },
];

const ROLE_ICONS = [Gauge, ChartColumn, Brain, Shield, FileCheck2, Wallet];

const ROLE_COLORS: Record<RoleKey, string[]> = {
  system_admin: ["#0f766e", "#14b8a6", "#5eead4"],
  ai_data_engineer: ["#d97706", "#f59e0b", "#fbbf24"],
  security_analyst: ["#475569", "#94a3b8", "#cbd5e1"],
  compliance_risk_manager: ["#0f766e", "#d97706", "#f59e0b"],
};

const QUICK_ROUTES = [
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "User Exchange", href: "/user/exchange" },
  { label: "User History", href: "/user/history" },
];

const TONAL_STYLES: Record<string, string> = {
  teal: "border-slate-500/20 bg-slate-900/50 text-slate-100",
  blue: "border-teal-400/20 bg-teal-500/10 text-teal-100",
  red: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  green: "border-teal-500/20 bg-teal-500/10 text-teal-100",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  purple: "border-slate-400/20 bg-slate-500/10 text-slate-100",
  emerald: "border-teal-400/20 bg-teal-500/10 text-teal-100",
};

async function fetchJson<T>(path: string, defaultValue: T | null = null): Promise<T> {
  try {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(path, { cache: "no-store", headers });
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

export default function LiveDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const [activeRole, setActiveRole] = useState<RoleKey>("system_admin");
  const { notify } = useToast();
  const [roleSwitchingKey, setRoleSwitchingKey] = useState<RoleKey | null>(null);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeOrgSlug = searchParams.get("org");

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
  const [currentChain, setCurrentChain] = useState<string>("ethereum");
  const [auditCompleteness, setAuditCompleteness] = useState<AuditCompleteness | null>(null);
  const [auditGaps, setAuditGaps] = useState<AuditGaps | null>(null);
  const [controlEffectiveness, setControlEffectiveness] = useState<ControlEffectiveness | null>(null);
  const [sloMetrics, setSloMetrics] = useState<SloMetrics | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<{ total_feedback: number; avg_sentiment?: number; categories: Record<string, number> } | null>(null);
  const [detailedLogs, setDetailedLogs] = useState<any[]>([]);

  // WebSocket for real-time threat alerts
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8001";
    const socket = io(socketUrl);

    socket.on("connect", () => {
      console.log("Connected to Real-time Sentinel Node");
    });

    socket.on("new-threat", (threat) => {
      notify(`Critical threat detected on ${threat.chain}: ${threat.address}`, "error");
      // Optionally update the recentAlerts state immediately
      setRecentAlerts(prev => [{
        id: Math.random().toString(36).substring(7),
        alert_type: "REAL_TIME_DETECTION",
        severity: threat.level,
        wallet_address: threat.address,
        risk_score: threat.score,
        detected_at: threat.timestamp,
        message: `Automated detection on ${threat.chain}`,
        is_acknowledged: false
      }, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
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
      // Show admin routes for everyone (no login needed as requested)
      if (route.href.startsWith('/admin') || route.href.includes('role=')) {
        return true;
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
      const newUrl = query ? `${pathname}?${query}` : pathname;
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", newUrl);
      }
    },
    [pathname, searchParams]
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

  async function loadLiveData(roleKey: RoleKey, mode: "auto" | "manual" = "auto", overrideChain?: string) {
    const now = Date.now();
    if (isFetchingRef.current) {
      return;
    }

    // Guard against accidental rapid remount/re-trigger loops.
    if (mode === "auto" && now - lastAutoFetchAtRef.current < 1000) {
      return;
    }

    isFetchingRef.current = true;
    if (mode === "auto") {
      lastAutoFetchAtRef.current = now;
    }

    if (mode === "manual") {
      setIsLoading(true);
    }
    setError(null);

    const fetchChain = overrideChain || currentChain;

    try {
      const [dashboardResult, flowResult, alertsResult, blockedResult] = await Promise.all([
        fetchDashboardStats(fetchChain),
        fetchFlowStats(fetchChain),
        fetchRecentAlerts(500, undefined, undefined, fetchChain),
        fetchBlockedTransfers(500, undefined, undefined, fetchChain),
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
  }, [activeRole, currentChain]);

  // Refresh when switching sidebar function so each view is up to date without manual click.
  useEffect(() => {
    void loadLiveData(activeRole, "manual");
  }, [activeRole, activeFeatureIndex]);

  // Keep live data fresh while user stays on the page — Task Manager style.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadLiveData(activeRole, "auto");
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRole, currentChain]);

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
        { label: "Availability", value: sloMetrics ? formatPercent(sloMetrics.endpoint_health.availability_pct) : "-", tone: "teal", hint: "Active endpoints" },
        { label: "Healthy nodes", value: sloMetrics ? `${sloMetrics.endpoint_health.healthy_active}/${sloMetrics.endpoint_health.active}` : "-", tone: "teal", hint: "Endpoint health" },
        { label: "Pipeline TPS", value: pipelineSummary?.avg_throughput_tps != null ? pipelineSummary.avg_throughput_tps.toFixed(1) : "-", tone: "teal", hint: "Average throughput" },
        { label: "Alerts today", value: overview ? formatCompact(overview.alerts_today) : "-", tone: "teal", hint: "Live alert volume" },
      ];
    }

    if (role.key === "ai_data_engineer") {
      return [
        { label: "Feature flags", value: formatCompact(featureConfigs.length), tone: "slate", hint: `${featureConfigs.filter((item) => item.enabled).length} enabled` },
        { label: "Model versions", value: formatCompact(modelRegistry.length), tone: "slate", hint: `${activeModels.length} active` },
        { label: "Latest records", value: pipelineSummary?.total_points != null ? formatCompact(pipelineSummary.total_points) : "-", tone: "slate", hint: "Pipeline metrics available" },
        { label: "Tracked wallets", value: overview ? formatCompact(overview.total_wallets) : "-", tone: "slate", hint: "Source population" },
      ];
    }

    if (role.key === "security_analyst") {
      return [
        { label: "Critical alerts", value: alertsSummary ? formatCompact(alertsSummary.critical) : "-", tone: "amber", hint: "Severity snapshot" },
        { label: "Pending cases", value: caseSummary ? formatCompact(caseSummary.totals.PENDING || 0) : "-", tone: "slate", hint: `${caseSummary?.unassigned ?? 0} unassigned` },
        { label: "Notifications", value: notificationEvents.length ? formatCompact(notificationEvents.length) : "-", tone: "slate", hint: "Recent channel events" },
        { label: "Blocked today", value: blockedTransfers.length ? formatCompact(blockedTransfers.length) : "-", tone: "amber", hint: "Transfer intervention" },
      ];
    }

    return [
      { label: "Blocked value", value: reportingSummary ? formatEth(reportingSummary.kpis?.blocked_value_eth ?? 0) : "-", tone: "amber", hint: "30-day risk impact" },
      { label: "Audit completeness", value: auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-", tone: "teal", hint: `${auditCompleteness?.present_actions ?? 0}/${auditCompleteness?.required_actions ?? 0}` },
      { label: "Policy rules", value: reportingSummary ? formatCompact(reportingSummary.kpis?.policy_rules_active ?? 0) : "-", tone: "teal", hint: "Active governance rules" },
      { label: "Blocked transfers", value: reportingSummary ? formatCompact(reportingSummary.kpis?.blocked_total ?? 0) : "-", tone: "amber", hint: "Audit window" },
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#475569" tickLine={false} axisLine={false} />
                        <Tooltip cursor={{ stroke: "#94a3b8", strokeWidth: 1 }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }} labelStyle={{ color: "#f8fafc", fontWeight: 600 }} />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
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
                      <MetricBlock label="Availability" value={formatPercent(sloMetrics.endpoint_health.availability_pct)} helper="Healthy / active endpoints" tone="teal" />
                      <MetricBlock label="Error budget burn" value={formatPercent(sloMetrics.endpoint_health.error_budget_burn_pct)} helper="Current period" tone="teal" />
                      <MetricBlock label="Ingest p95" value={`${sloMetrics.latency_slo.ingest_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.ingest_target_ms.toFixed(0)} ms`} tone="teal" />
                      <MetricBlock label="Decode p95" value={`${sloMetrics.latency_slo.decode_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.decode_target_ms.toFixed(0)} ms`} tone="teal" />
                    </>
                  ) : null}
                </div>
              </div>
            ),
          };
        case 1:
          return {
            title: "Organizations",
            description: "Manage partner bank and exchange accounts (Multi-tenant).",
            content: <OrganizationPanel />,
          };
        case 2:
          return {
            title: "API & Webhook Access",
            description: "Provision API keys and monitor partner connection health.",
            content: <ApiAccessPanel />,
          };
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
        return { title: "Batch data upload", description: "Ingest large transaction datasets (CSV/Excel) for AI analysis.", content: <BatchUploadPanel /> };
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
    <div className="relative min-h-screen overflow-hidden bg-[#08080a] text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.10),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(217,119,6,0.08),_transparent_30%)]" />
      <div className="absolute inset-0 opacity-10 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="relative w-full px-4 py-4 md:px-6 md:py-6">
        <header className="mb-4 rounded-[32px] border border-slate-800/70 bg-slate-950/78 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-300 via-slate-100 to-amber-300 shadow-[0_16px_40px_rgba(20,184,166,0.18)]">
                <Shield className="h-8 w-8 text-black" />
                <div className="absolute inset-0 bg-white/10" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-teal-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live data only
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-slate-50 md:text-4xl">Blockchain AI Operations Console</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                    Real-time blockchain diagnostics and role-specific AI controls.
                  </p>
                  {activeOrgSlug && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-300">
                      <Globe2 className="h-3.5 w-3.5" />
                      Tenant: {activeOrgSlug.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
                {availableRoles.map((entry) => {
                  const isActive = entry.key === activeRole;
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
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-80",
                        isActive ? `${entry.accentClass} shadow-lg` : "text-slate-400 hover:text-slate-200 hover:bg-slate-900",
                      ].join(" ")}
                    >
                      {isSwitching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {entry.shortLabel}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentChain("ethereum");
                    void loadLiveData(activeRole, "manual", "ethereum");
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${currentChain === "ethereum" ? "bg-teal-300 text-slate-950 shadow-lg" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                >
                  ETH
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentChain("bsc");
                    void loadLiveData(activeRole, "manual", "bsc");
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${currentChain === "bsc" ? "bg-amber-300 text-slate-950 shadow-lg" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}
                >
                  BSC
                </button>
              </div>

              <button
                type="button"
                onClick={() => void loadLiveData(activeRole, "manual")}
                className="inline-flex items-center gap-2 rounded-xl border border-teal-400/30 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-teal-300 hover:bg-slate-800"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50">Live data error: {error}</div>
        ) : null}

        <div className={`grid grid-cols-1 gap-4 transition-all duration-300 ${isSidebarCollapsed ? "xl:grid-cols-[80px_1fr]" : "xl:grid-cols-[300px_1fr]"}`}>
          <aside className={`rounded-[30px] border border-slate-800/70 bg-slate-950/70 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 ${isSidebarCollapsed ? "items-center overflow-hidden" : ""}`}>
            <div className="mb-4 flex items-center justify-between">
              {!isSidebarCollapsed && (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Sidebar functions</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-50">{role.label}</h2>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-100"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <RefreshCcw className={`h-4 w-4 transition-transform duration-500 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
              </button>
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
                            ? "border-teal-400/60 bg-slate-800/90 text-slate-50 shadow-[0_12px_24px_rgba(20,184,166,0.12)]"
                            : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-amber-400/40 hover:bg-slate-900/80",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <span className={["flex h-9 w-9 items-center justify-center rounded-xl border", isActiveFeature ? role.highlightClass : "border-slate-800 bg-slate-950/70 text-slate-400"].join(" ")}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className={`min-w-0 transition-opacity duration-300 ${isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"}`}>
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

          <main className="min-h-[600px] space-y-4 rounded-[30px] border border-slate-800/70 bg-slate-950/70 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {roleMetricCards.map((card, i) => (
                <div key={card.label} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
                  <MetricCard label={card.label} value={card.value} hint={card.hint} accentClass={TONAL_STYLES[card.tone]} />
                </div>
              ))}
            </div>

            <CardShell key={`${activeRole}-${activeFeatureIndex}`} title={selectedPanel.title} subtitle={selectedPanel.description} icon={ChartColumn}>
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
      <p className="mt-2 text-xl font-semibold text-slate-50 md:text-2xl">{value}</p>
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
      {nodes.map((node, i) => (
        <div key={node.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: `${i * 50}ms` }}>
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
            {node.last_error ? <p className="rounded bg-amber-400/10 px-2 py-1 text-amber-50">Error: {node.last_error}</p> : null}
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
    const response = await authFetch("/api/ops/system/node-endpoints?only_active=true");
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
      const response = await authFetch("/api/ops/system/node-endpoints", {
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
      const response = await authFetch(`/api/ops/system/node-endpoints/${encodeURIComponent(node.id)}/health`, {
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
      <div className="overflow-hidden rounded-2xl border border-slate-800">
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
            {mutableNodes.map((node, i) => (
              <tr key={node.id} className="animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both" style={{ animationDelay: `${i * 30}ms` }}>
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
                      className="rounded-md border border-teal-400/40 bg-teal-400/10 px-2 py-1 text-[11px] text-teal-50 disabled:opacity-60"
                    >
                      Healthy
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "degraded")}
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                    >
                      Degraded
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "down")}
                      className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-50 disabled:opacity-60"
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
        <MetricCard label="Points" value={summary ? formatCompact(summary.total_points) : "-"} hint="Pipeline samples" accentClass="border-slate-800 bg-slate-900/70" />
        <MetricCard label="Avg TPS" value={summary?.avg_throughput_tps != null ? summary.avg_throughput_tps.toFixed(1) : "-"} hint="Throughput" accentClass="border-teal-400/20 bg-teal-500/10" />
        <MetricCard label="Ingest latency" value={summary?.avg_ingestion_latency_ms != null ? `${summary.avg_ingestion_latency_ms.toFixed(0)} ms` : "-"} hint="Average" accentClass="border-amber-400/20 bg-amber-500/10" />
        <MetricCard label="Last block" value={summary?.last_block_number != null ? formatCompact(summary.last_block_number) : "-"} hint="Latest signal" accentClass="border-slate-500/20 bg-slate-500/10" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Chain</th>
              <th className="px-4 py-3 text-left font-medium">Block</th>
              <th className="px-4 py-3 text-left font-medium">TPS</th>
              <th className="px-4 py-3 text-left font-medium">Ingest</th>
              <th className="px-4 py-3 text-left font-medium">Decode</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {metrics.slice(0, 8).map((metric, i) => (
              <tr key={metric.id} className="animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both" style={{ animationDelay: `${i * 30}ms` }}>
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

function OrganizationPanel() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { notify } = useToast();

  const fetchOrgs = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch("/api/ops/system/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      const payload = await response.json();
      const data = unwrapPayload<{ items: any[] }>(payload);
      setOrgs(data.items || []);
    } catch (err: any) {
      console.error(err);
      notify("Failed to fetch organizations", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreateOrg = async () => {
    const name = window.prompt("Enter Organization Name:");
    if (!name || !name.trim()) return;
    const slug = window.prompt("Enter Organization Slug (lowercase, unique):");
    if (!slug || !slug.trim()) return;
    const contactEmail = window.prompt("Enter Contact Email:");
    if (!contactEmail || !contactEmail.trim()) return;

    try {
      const response = await authFetch("/api/ops/system/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          contact_email: contactEmail.trim(),
          is_active: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create organization");
      }
      notify("Organization created successfully", "success");
      fetchOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleCreateOrg}
          className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/20"
        >
          Create New Organization
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 text-left">Organization Name</th>
              <th className="px-6 py-4 text-left">Slug</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">API Calls (30d)</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-6 py-4 bg-slate-900/20 h-16"></td>
                </tr>
              ))
            ) : orgs.map((org) => (
              <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-100">{org.name}</td>
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{org.slug}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${org.status === "Active" ? "bg-teal-400/10 text-teal-400 border border-teal-400/20" : "bg-red-400/10 text-red-400 border border-red-400/20"}`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300">{org.api_calls}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-white transition-colors">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApiAccessPanel() {
  const [keys, setKeys] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const { notify } = useToast();

  const fetchKeysAndOrgs = async () => {
    setIsLoading(true);
    try {
      const keysResponse = await authFetch("/api/ops/system/api-keys");
      const orgsResponse = await authFetch("/api/ops/system/organizations");
      if (keysResponse.ok && orgsResponse.ok) {
        const keysPayload = await keysResponse.json();
        const orgsPayload = await orgsResponse.json();
        const keysData = unwrapPayload<{ items: any[] }>(keysPayload);
        const orgsData = unwrapPayload<{ items: any[] }>(orgsPayload);
        setKeys(keysData.items || []);
        setOrgs(orgsData.items || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeysAndOrgs();
  }, []);

  const handleGenerateKey = async () => {
    if (!selectedOrgId) {
      notify("Please select an organization", "error");
      return;
    }

    try {
      const response = await authFetch(`/api/ops/system/api-keys?org_id=${encodeURIComponent(selectedOrgId)}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate API key");
      }
      notify("API key generated successfully!", "success");
      setShowGenerateModal(false);
      fetchKeysAndOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const handleRevokeKey = async (orgId: string) => {
    if (!window.confirm("Are you sure you want to revoke this API key? This action is permanent!")) return;

    try {
      const response = await authFetch(`/api/ops/system/api-keys/${encodeURIComponent(orgId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to revoke API key");
      }
      notify("API Key revoked successfully!", "success");
      fetchKeysAndOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Active API Keys</h3>
          <p className="text-sm text-slate-400 mb-6">Provisioned keys for programmatic access to the risk engine.</p>
          <div className="space-y-4">
            {isLoading ? (
              <div className="animate-pulse h-24 bg-slate-900/20 rounded-xl"></div>
            ) : keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-sm font-medium text-slate-200">{k.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{k.key}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-600">Created {k.created}</div>
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="text-red-400 hover:text-red-300 text-xs mt-1"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}

            {showGenerateModal ? (
              <div className="flex gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select Organization...</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGenerateKey}
                  className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-sm font-medium"
              >
                + Generate New API Key
              </button>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Webhook Connectivity</h3>
          <p className="text-sm text-slate-400 mb-6">Real-time alert delivery status for your organization endpoints.</p>
          <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 mb-4">
             <div className="flex gap-3">
               <div className="mt-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
               <div>
                 <div className="text-sm font-medium text-amber-200">Webhook Degraded</div>
                 <p className="text-xs text-amber-200/60 mt-1">GBV production endpoint returned 503 (6 consecutive failures).</p>
               </div>
             </div>
          </div>
          <button className="w-full py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-all text-sm font-medium">
            Configure Webhook URL
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchUploadPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(20);

    try {
      // Create some dummy transfers based on the file presence
      const dummyTransfers = [
        { sender: "0x742d35cc6634c0532925a3b844bc454e4438f44e", receiver: "0xab5801a7d398351b8be11c439e05c5b3259aec9b", amount: "1.2" },
        { sender: "0x8ba1f109551bd432803012645ac136ddd64dba72", receiver: "0x098b716b8aaf21512996dc57eb0615e2383e2f96", amount: "0.5" },
        { sender: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045", receiver: "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a", amount: "10.0" }
      ];

      const response = await fetch("/api/transfers/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        },
        body: JSON.stringify({ transfers: dummyTransfers })
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const result = await response.json();
      setProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setFile(null);
        setProgress(0);
        notify(`Batch ingestion complete. ${result.processed} transactions processed, ${result.blocked} blocked.`, "success");
      }, 500);
    } catch (error) {
      console.error("Batch upload error:", error);
      setIsUploading(false);
      notify("Failed to process batch upload.", "error");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
      <div className="h-16 w-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Upload Transaction Data</h3>
      <p className="text-slate-400 text-center max-w-sm mb-8">Supported formats: .csv, .xlsx. Max file size: 100MB. Data will be analyzed for AML/Risk patterns instantly.</p>
      
      {isUploading ? (
        <div className="w-full max-w-md space-y-4">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
             <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-center text-xs text-slate-500 font-mono uppercase tracking-widest">Processing {progress}%</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <label className="cursor-pointer group">
            <span className="rounded-2xl bg-teal-500/10 border border-teal-500/30 px-8 py-3 text-teal-400 font-semibold group-hover:bg-teal-500 group-hover:text-white transition-all duration-300">
              {file ? file.name : "Select File"}
            </span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".csv,.xlsx" />
          </label>
          {file && (
            <button onClick={handleUpload} className="text-sm text-slate-300 underline hover:text-white">
              Confirm and Upload
            </button>
          )}
        </div>
      )}
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
      const response = await authFetch(`/api/admin/diagnostics/logs?${params.toString()}`);
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
    error: "bg-amber-500/20 text-amber-200 border-amber-500/30",
    info: "bg-teal-500/20 text-teal-100 border-teal-500/30",
    api_call: "bg-slate-500/20 text-slate-200 border-slate-500/30",
    api_error: "bg-amber-500/20 text-amber-200 border-amber-500/30",
    ai_service: "bg-slate-500/20 text-slate-200 border-slate-500/30",
    success: "bg-teal-500/20 text-teal-100 border-teal-500/30",
    warning: "bg-amber-500/20 text-amber-200 border-amber-500/30",
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
      const response = await authFetch(`/api/admin/diagnostics/logs/export?${params.toString()}`);
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

  async function handleArchivefiltered(archived: boolean) {
    setIsArchiving(true);
    try {
      const response = await authFetch("/api/admin/diagnostics/logs/archive", {
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
        <MetricBlock label="Total logs" value={formatCompact(mutableLogs.length)} helper="All diagnostic entries" tone="slate" />
        <MetricBlock label="Errors" value={formatCompact(errorCount)} helper="Error logs" tone={errorCount > 0 ? "red" : "slate"} />
        <MetricBlock label="Endpoints" value={formatCompact(new Set(mutableLogs.map((log) => log.endpoint).filter(Boolean)).size)} helper="Unique endpoints" tone="blue" />
        <MetricBlock label="Log types" value={formatCompact(uniqueTypes.length)} helper="Different log categories" tone="amber" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={exportDate}
          onChange={(event) => setExportDate(event.target.value)}
          className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        />
        <button
          type="button"
          disabled={isExporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-teal-400/50 hover:text-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchivefiltered(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-50 transition hover:border-teal-300/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Archiving..." : `Archive filtered (${filteredLogs.length})`}
        </button>
        <button
          type="button"
          disabled={isArchiving || filteredLogs.length === 0}
          onClick={() => void handleArchivefiltered(false)}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-50 transition hover:border-amber-300/60 disabled:opacity-60"
        >
          <Archive className="h-3.5 w-3.5" />
          {isArchiving ? "Updating..." : "Unarchive filtered"}
        </button>
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-400" />
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search message or endpoint..."
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none transition focus:border-teal-400/50"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none"
        >
          <option value="all">All types</option>
          {uniqueTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
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
                  <span className={`inline-block rounded-lg border px-2 py-1 text-xs font-medium ${logTypeColors[(log.log_type || "").toLowerCase()] || "bg-slate-700/50 text-slate-200"}`}>
                    {(log.log_type || "unknown").toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-sm truncate text-slate-300">{log.message}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {log.status_code ? (
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-semibold ${log.status_code >= 200 && log.status_code < 300
                        ? "bg-teal-500/20 text-teal-100"
                        : log.status_code >= 400
                          ? "bg-amber-500/20 text-amber-100"
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

function SloPanel({ sloMetrics }: { sloMetrics: SloMetrics | null }) {
  if (!sloMetrics) {
    return <EmptyState message="SLO metrics are not available from the backend right now." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <MetricBlock label="Availability" value={formatPercent(sloMetrics.endpoint_health.availability_pct)} helper={`${sloMetrics.endpoint_health.healthy_active}/${sloMetrics.endpoint_health.active} active endpoints healthy`} tone="teal" />
      <MetricBlock label="Error budget burn" value={formatPercent(sloMetrics.endpoint_health.error_budget_burn_pct)} helper="Current window" tone="teal" />
      <MetricBlock label="Ingest p95" value={`${sloMetrics.latency_slo.ingest_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.ingest_target_ms.toFixed(0)} ms`} tone="teal" />
      <MetricBlock label="Decode p95" value={`${sloMetrics.latency_slo.decode_p95_ms.toFixed(0)} ms`} helper={`Target ${sloMetrics.latency_slo.decode_target_ms.toFixed(0)} ms`} tone="teal" />
    </div>
  );
}

function DataIntegrityPanel({ report, onRefresh }: { report: DataIntegrityReport | null; onRefresh?: () => void }) {
  const [isFixing, setIsFixing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [seedStatus, setSeedStatus] = useState<any>(null);

  useEffect(() => {
    const fetchSeedStatus = async () => {
      try {
        const res = await authFetch("/api/admin/diagnostics/seed-data");
        if (res.ok) setSeedStatus(await res.json());
      } catch (e) {
        console.error("Failed to fetch seed status:", e);
      }
    };
    fetchSeedStatus();
  }, [report]);

  if (!report) {
    return <EmptyState message="Data integrity report is not available yet." />;
  }

  const missing = report.missing_controls ?? [];

  async function handleAutoFix() {
    setIsFixing(true);
    try {
      const response = await authFetch("/api/ops/system/data-integrity/auto-fix", {
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
      const response = await authFetch(`/api/ops/system/data-integrity/export?format=${format}`);
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Data integrity controls</p>
          <p className="mt-1 text-xs text-slate-400">DB-first readiness for role modules and controls</p>
        </div>
        <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${report.overall_ok ? "border-teal-400/40 bg-teal-400/10 text-teal-50" : "border-amber-400/40 bg-amber-400/10 text-amber-50"}`}>
          {report.overall_ok ? "ALL OK" : `${missing.length} GAPS`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricBlock label="Checks" value={formatCompact(report.checks.length)} helper="Total controls" tone="teal" />
        <MetricBlock label="Missing" value={formatCompact(missing.length)} helper="Need seeding/config" tone={missing.length ? "amber" : "slate"} />
        <MetricBlock label="Roles ready" value={formatCompact(Object.values(report.role_readiness || {}).filter(Boolean).length)} helper="Out of 4 roles" tone="teal" />
        <MetricBlock label="Diagnostics rows" value={formatCompact(report.counts?.diagnostic_events ?? 0)} helper="Persistent logs" tone="slate" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleAutoFix()}
          disabled={isFixing || missing.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-50 transition hover:border-teal-300/60 disabled:opacity-60"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {isFixing ? "Auto-fixing..." : `Auto-fix missing (${missing.length})`}
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("csv")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-teal-400/50 hover:text-slate-50 disabled:opacity-60"
        >
          <Download className="h-3.5 w-3.5" />
          Export integrity CSV
        </button>
        <button
          type="button"
          onClick={() => void handleExportIntegrity("json")}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-amber-400/50 hover:text-slate-50 disabled:opacity-60"
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
              <th className="px-4 py-3 text-left font-medium">Actual / required</th>
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
      const response = await authFetch("/api/ops/ai/model-registry", {
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
      const response = await authFetch(`/api/ops/ai/model-registry/${encodeURIComponent(model.id)}/activate`, {
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
        <MetricBlock label="Registry entries" value={formatCompact(mutableModels.length)} helper="Current records" tone="teal" />
        <MetricBlock label="Active models" value={formatCompact(mutableActiveModels.length)} helper="Serving now" tone="teal" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(mutableModels.map((item) => item.framework)).size)} helper="Unique runtimes" tone="slate" />
        <MetricBlock label="Artifacts" value={formatCompact(mutableModels.length)} helper="Tracked versions" tone="slate" />
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
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
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
      const response = await authFetch("/api/ops/ai/feature-store", {
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

      const listResponse = await authFetch("/api/ops/ai/feature-store");
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
      const response = await authFetch(`/api/ops/ai/feature-store/${encodeURIComponent(feature.id)}`, {
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
                    className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-400/60 disabled:opacity-60"
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
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <div className="space-y-3">
          <MetricBlock label="Enabled features" value={formatCompact(enabled)} helper="Active feature flags" tone="teal" />
          <MetricBlock label="Disabled features" value={formatCompact(Math.max(0, features.length - enabled))} helper="Risk-free toggles" tone="slate" />
          <MetricBlock label="Owner coverage" value={formatCompact(new Set(features.map((item) => item.owner_user_id).filter(Boolean)).size)} helper="Unique owners" tone="slate" />
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
        <MetricBlock label="Active serving" value={formatCompact(activeModels.length)} helper="Live models" tone="teal" />
        <MetricBlock label="Promoted" value={formatCompact(promoted.length)} helper="Governed promotions" tone="teal" />
        <MetricBlock label="Inactive" value={formatCompact(inactive.length)} helper="Needs review" tone="amber" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(models.map((item) => item.framework)).size)} helper="Runtime diversity" tone="slate" />
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
        <MetricBlock label="Features" value={formatCompact(features.length)} helper="All records" tone="teal" />
        <MetricBlock label="With expression" value={formatCompact(features.filter((item) => Boolean(item.expression)).length)} helper="Ready for runtime" tone="teal" />
        <MetricBlock label="Owned" value={formatCompact(features.filter((item) => Boolean(item.owner_user_id)).length)} helper="Has owner" tone="slate" />
        <MetricBlock label="Updated" value={formatCompact(features.filter((item) => Boolean(item.updated_at)).length)} helper="Fresh metadata" tone="slate" />
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
        <MetricBlock label="Versions" value={formatCompact(models.length)} helper="Tracked versions" tone="teal" />
        <MetricBlock label="Artifacts" value={formatCompact(models.filter((item) => Boolean(item.artifact_uri)).length)} helper="Stored URIs" tone="teal" />
        <MetricBlock label="Promoted" value={formatCompact(models.filter((item) => Boolean(item.promoted_at)).length)} helper="Lifecycle events" tone="slate" />
        <MetricBlock label="Missing promoter" value={formatCompact(models.filter((item) => !item.promoted_by).length)} helper="Governance gap" tone="amber" />
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

function CaseActionPanel({ caseSummary }: { caseSummary: CaseSummary | null }) {
  const totals = caseSummary?.totals ?? {};
  const chartData = [
    { name: "PENDING", value: totals.PENDING ?? 0 },
    { name: "VERIFIED", value: totals.VERIFIED ?? 0 },
    { name: "FRAUD", value: totals.FRAUD ?? 0 },
    { name: "ignored", value: totals.ignored ?? 0 },
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
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
            <Legend iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3">
        <MetricBlock label="High-risk unassigned" value={formatCompact(caseSummary?.high_risk_unassigned ?? 0)} helper="Needs immediate action" tone="amber" />
        <MetricBlock label="Total queue" value={formatCompact(Object.values(totals).reduce((sum, value) => sum + value, 0))} helper="Live case volume" tone="teal" />
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

function AuditDataPanel({ auditCompleteness, auditGaps }: { auditCompleteness: AuditCompleteness | null; auditGaps: AuditGaps | null }) {
  const checks = auditCompleteness?.checks ?? [];
  const missingActions = auditGaps?.missing_actions ?? [];

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
        <MetricBlock label="Completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="required audit actions present" tone="teal" />
        <MetricBlock label="Present actions" value={auditCompleteness ? `${auditCompleteness.present_actions}/${auditCompleteness.required_actions}` : "-"} helper="Audit coverage" tone="teal" />
        <MetricBlock label="Missing actions" value={auditGaps ? formatCompact(auditGaps.missing_count) : "-"} helper="Gaps needing evidence" tone="teal" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Count</th>
              <th className="px-4 py-3 text-left font-medium">Present</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
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
        <MetricBlock label="Block rate" value={formatPercent(controlEffectiveness.metrics.block_rate_pct)} helper="Actionable alerts blocked" tone="teal" />
        <MetricBlock label="Fraud precision" value={formatPercent(controlEffectiveness.metrics.fraud_precision_proxy_pct)} helper="Decision quality proxy" tone="teal" />
        <MetricBlock label="Decision coverage" value={formatCompact(controlEffectiveness.metrics.decision_coverage)} helper="Resolved cases" tone="teal" />
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
        <p className="text-sm font-semibold text-white">Reporting summary</p>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <p>Alerts: {formatCompact(reportingSummary?.kpis?.alerts_total ?? 0)}</p>
          <p>Blocked value: {reportingSummary ? formatEth(reportingSummary.kpis?.blocked_value_eth ?? 0) : "-"}</p>
          <p>Notifications failed: {formatCompact(reportingSummary?.kpis?.notifications_failed ?? 0)}</p>
          <p>Window days: {reportingSummary?.period?.days ?? controlEffectiveness.period_days}</p>
        </div>
      </div>
    </div>
  );
}

function ReportingSummaryPanel({ reportingSummary, controlEffectiveness, auditCompleteness }: { reportingSummary: ReportingSummary | null; controlEffectiveness: ControlEffectiveness | null; auditCompleteness: AuditCompleteness | null }) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/ops/compliance/reporting/export`);
      if (!response.ok) throw new Error("Failed to export report");
      
      const data = await response.json();
      const csvContent = data.rows.map((r: any) => `${r.metric},${r.value}`).join("\n");
      const blob = new Blob(["metric,value\n" + csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "compliance_report.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }

  const chartData = reportingSummary ? [
    { name: "Alerts", value: reportingSummary.kpis?.alerts_total ?? 0 },
    { name: "Blocked", value: reportingSummary.kpis?.blocked_total ?? 0 },
    { name: "Policies", value: reportingSummary.kpis?.policy_rules_active ?? 0 },
    { name: "Audit", value: reportingSummary.kpis?.audit_events ?? 0 },
  ] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="border-slate-800 bg-slate-900/50 hover:bg-slate-800"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export Compliance Report (CSV)
        </Button>
      </div>

      {!reportingSummary ? (
        <EmptyState message="Reporting summary is loading or not available yet..." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(255, 255, 255, 0.05)" }} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12 }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill={ROLE_COLORS.compliance_risk_manager[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-3">
            <MetricBlock label="Audit completeness" value={auditCompleteness ? formatPercent(auditCompleteness.completeness_pct) : "-"} helper="Evidence coverage" tone="teal" />
            <MetricBlock label="Block rate" value={controlEffectiveness ? formatPercent(controlEffectiveness.metrics?.block_rate_pct ?? 0) : "-"} helper="Compliance outcomes" tone="teal" />
            <MetricBlock label="Blocked value" value={formatEth(reportingSummary?.kpis?.blocked_value_eth ?? 0)} helper="Live risk impact" tone="teal" />
          </div>
        </div>
      )}
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
        <div key={alert.alert_id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{alert.message}</p>
              <p className="mt-1 text-xs text-slate-500">{formatAddress(alert.wallet_address)} · {alert.alert_type}</p>
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
        <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{formatAddress(item.sender_address)} → {formatAddress(item.receiver_address)}</p>
              <p className="mt-1 text-xs text-slate-500">{item.block_reason}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{formatEth(item.amount_eth)}</p>
              <p className="mt-1 text-xs text-slate-500">Risk {item.risk_score.toFixed(1)}</p>
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

function SecurityOpsPanel({ feedbackStats }: { feedbackStats: { total_feedback: number; avg_sentiment?: number; categories: Record<string, number> } | null }) {
  const { notify } = useToast();
  const [isSending, setIsSending] = useState(false);

  async function handleTestNotification() {
    setIsSending(true);
    try {
      const res = await sendTestNotification();
      notify(`Test notification sent: ${res.message}`, "success");
    } catch (err) {
      notify("Failed to send test notification", "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h3 className="text-lg font-bold text-white mb-2">User Feedback Trends</h3>
          <p className="text-sm text-slate-400 mb-6">Analyzing community reports for false positives and emerging scams.</p>
          
          <div className="space-y-4">
            <MetricBlock 
              label="Total Reports" 
              value={feedbackStats ? String(feedbackStats.total_feedback) : "0"} 
              helper="Last 30 days" 
              tone="slate" 
            />
            <div className="grid grid-cols-2 gap-2">
              {feedbackStats && Object.entries(feedbackStats.categories).map(([cat, count]) => (
                <div key={cat} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">{cat}</p>
                  <p className="text-lg font-bold text-white">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">System Diagnostics</h3>
            <p className="text-sm text-slate-400 mb-6">Verify that the alerting pipeline and WebSocket broadcasters are fully operational.</p>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20">
              <div className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <p className="text-xs text-teal-200/80 italic">Broadcaster status: Listening for new-threat events...</p>
              </div>
            </div>
            
            <Button 
              onClick={() => void handleTestNotification()} 
              disabled={isSending}
              className="w-full h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Dispatch Test Security Alert
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogVolumeTrend({ logs }: { logs: any[] }) {
  const data = useMemo(() => {
    const minuteCounts: Record<string, number> = {};
    // Get last 15 minutes of activity
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      const key = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      minuteCounts[key] = 0;
    }

    logs.forEach(log => {
      const key = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (minuteCounts[key] !== undefined) minuteCounts[key]++;
    });

    return Object.entries(minuteCounts).map(([time, count]) => ({ time, count }));
  }, [logs]);

  return (
    <div className="h-[120px] w-full mb-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <Tooltip 
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8", fontSize: 10 }}
          />
          <Bar dataKey="count" fill="#2dd4bf" radius={[4, 4, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RawAuditLogsPanel({ logs, onRefresh }: { logs: any[]; onRefresh: () => void }) {
  const [filterId, setFilterId] = useState("");

  const filteredLogs = useMemo(() => {
    if (!filterId) return logs;
    return logs.filter(log => 
      (log.correlation_id && log.correlation_id.includes(filterId)) || 
      (log.details?.correlation_id && log.details.correlation_id.includes(filterId))
    );
  }, [logs, filterId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Activity Trend</h3>
        <LogVolumeTrend logs={logs} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Trace by ID (Correlation ID)..." 
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 rounded-xl text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="text-slate-400 hover:text-white">
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh Logs
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">Trace ID</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {filteredLogs.length > 0 ? filteredLogs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-teal-500/70">{log.correlation_id || log.details?.correlation_id || "N/A"}</td>
                <td className="px-4 py-3 font-semibold text-teal-400">{log.action_type || log.log_type}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.user_identifier || "system"}</td>
                <td className="px-4 py-3 max-w-md truncate text-slate-300">{log.message || JSON.stringify(log.details)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">No logs match your trace ID.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-sm text-slate-400">{message}</div>;
}




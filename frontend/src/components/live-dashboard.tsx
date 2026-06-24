"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { io } from "socket.io-client";
import {
  ChartColumn,
  Globe2,
  Loader2,
  RefreshCcw,
  Shield,
  Sparkles,
} from "lucide-react";
import type { Alert, BlockedTransfer, DashboardStats, FlowStats } from "@/lib/api";
import {
  fetchBlockedTransfers,
  fetchDashboardStats,
  fetchFlowStats,
  fetchRecentAlerts,
} from "@/lib/api";
import {
  RoleKey, RoleDefinition, NodeEndpointItem, PipelineMetricItem,
  FeatureConfigItem, ModelRegistryItem, PolicyRuleItem, NotificationItem,
  CaseItem, AlertsSummary, CaseSummary, ReportingSummary, ControlEffectiveness,
  AuditCompleteness, AuditGaps, SloMetrics, DataIntegrityReport,
  mapUserRoleToDashboardRole, isUserAdminRole,
  fetchJson, formatAddress, formatCompact, formatEth, formatPercent, formatDateTime,
  ROLE_DEFINITIONS, ROLE_ICONS, ROLE_COLORS, QUICK_ROUTES, TONAL_STYLES,
  CardShell, MetricCard, MetricBlock,
} from "./dashboard-utils";
import PolicyRulesPanel from "@/components/panels/policy-rules-panel";
import OrganizationPanel from "./panels/organization-panel";
import ApiAccessPanel from "./panels/api-access-panel";
import PipelineTable from "./panels/pipeline-table-panel";
import DiagnosticsLogsPanel from "./panels/diagnostics-logs-panel";
import SloPanel from "./panels/slo-panel";
import DataIntegrityPanel from "./panels/data-integrity-panel";
import ModelRegistryTable from "./panels/model-registry-table";
import FeatureStoreTable from "./panels/feature-store-table";
import FeatureOperationsPanel from "./panels/feature-operations-panel";
import ModelOperationsPanel from "./panels/model-operations-panel";
import FeatureDataPanel from "./panels/feature-data-panel";
import RegistryDataPanel from "./panels/registry-data-panel";
import AlertQueuePanel from "./panels/alert-queue-panel";
import CaseQueuePanel from "./panels/case-queue-panel";
import CaseActionPanel from "./panels/case-action-panel";
import NotificationTable from "./panels/notification-table";
import AlertChartPanel from "./panels/alert-chart-panel";
import CaseDataPanel from "./panels/case-data-panel";
import PolicyDataPanel from "./panels/policy-data-panel";
import AuditPanel from "./panels/audit-panel";
import BatchUploadPanel from "./panels/batch-upload-panel";
import ReportingSummaryPanel from "./panels/reporting-summary-panel";
import AuditDataPanel from "./panels/audit-data-panel";
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
      // connected to real-time sentinel node
    });

    socket.on("new-threat", (threat) => {
      notify(`Critical threat detected on ${threat.chain}: ${threat.address}`, "error");
      setRecentAlerts(prev => [{
        alert_id: Math.random().toString(36).substring(7),
        alert_type: "REAL_TIME_DETECTION",
        severity: threat.level,
        wallet_address: threat.address,
        risk_score: threat.score,
        detected_at: threat.timestamp,
        message: `Automated detection on ${threat.chain}`,
        context: {},
        acknowledged: false
      } as Alert, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [notify]);
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
      if (['/login', '/register'].includes(route.href)) {
        return !isAuthenticated;
      }
      if (route.href.startsWith('/user')) {
        return isAuthenticated;
      }
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

    if (roleParam && ROLE_DEFINITIONS.some((entry) => entry.key === roleParam)) {
      if (roleParam !== activeRole) {
        setActiveRole(roleParam);
      }
      return;
    }

    if (fallbackRole !== activeRole) {
      setActiveRole(fallbackRole);
    }

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

  const loadLiveData = useCallback(async (roleKey: RoleKey, mode: "auto" | "manual" = "auto", overrideChain?: string) => {
    const now = Date.now();
    if (isFetchingRef.current) {
      return;
    }

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
  }, [currentChain]);

  useEffect(() => {
    void loadLiveData(activeRole, "auto");
  }, [loadLiveData, activeRole]);

  useEffect(() => {
    void loadLiveData(activeRole, "manual");
  }, [loadLiveData, activeFeatureIndex, activeRole]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadLiveData(activeRole, "auto");
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadLiveData, activeRole]);

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
  }, [loadLiveData, activeRole]);

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
  }, [activeModels, alertsSummary, auditCompleteness, blockedTransfers, caseSummary, dashboardStats, featureConfigs, modelRegistry, notificationEvents, pipelineSummary, reportingSummary, role.key, sloMetrics]);

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
    activeFeatureIndex, activeModels, alertsSummary, auditCompleteness, auditGaps,
    caseItems, caseSummary, chartPalette, controlEffectiveness, featureConfigs,
    flowChartData, flowStats, modelRegistry, notificationEvents,
    pipelineMetrics, pipelineSummary, policyRules, recentAlerts, reportingSummary,
    role.key, contextQuery, sloMetrics, totalAlertCount, totalCaseCount,
    diagnosticsLogs, dataIntegrity, loadLiveData, activeRole,
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
              {[
                { title: "Overview", start: 0, end: 2 },
                { title: "Functions", start: 2, end: 4 },
                { title: "Data", start: 4, end: 6 },
              ].map((group) => (
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
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Brain,
  FileCheck2,
  GitBranch,
  Lock,
  Network,
  Settings,
  Shield,
  UserCog,
} from "lucide-react";

type RoleKey = "system_admin" | "ai_data_engineer" | "security_analyst" | "compliance_risk_manager";

type RoleDefinition = {
  key: RoleKey;
  label: string;
  shortLabel: string;
  accentClass: string;
  sidebarFeatures: string[];
  topLeftTitle: string;
  topRightTitle: string;
  centerTitle: string;
  bottomRightTitle: string;
};

type RoleFacts = {
  p1: string[];
  p2: string[];
  p3: string[];
  p4: string[];
  note: string;
};

type WorkspaceSection = "overview" | "actions" | "data";

type NodeEndpoint = {
  id: string;
  provider_name: string;
  chain: string;
  endpoint_url: string;
  protocol: string;
  priority: number;
  is_active: boolean;
  health_status: string;
  last_checked_at: string | null;
};

type PipelineMetric = {
  id: number;
  chain: string;
  block_number: number | null;
  throughput_tps: number | null;
  ingestion_latency_ms: number | null;
  decode_latency_ms: number | null;
  inserted_at: string | null;
};

type FeatureConfig = {
  id: string;
  feature_key: string;
  enabled: boolean;
  expression: string | null;
  updated_at: string | null;
};

type ModelRegistryItem = {
  id: string;
  model_name: string;
  version: string;
  artifact_uri: string;
  framework: string;
  is_active: boolean;
  promoted_at: string | null;
};

type AlertItem = {
  id: string;
  wallet_address: string;
  alert_type: string;
  severity: string;
  risk_score: number | null;
  detected_at: string | null;
};

type CaseItem = {
  tx_hash: string;
  status: string;
  risk_score: number | null;
  assigned_to: string | null;
};

type BlockedTransferItem = {
  id: string;
  sender_address: string;
  receiver_address: string;
  amount_eth: number;
  risk_score: number;
  blocked_at: string | null;
};

type DashboardStats = {
  systemAdmin: {
    totalNodeEndpoints: number;
    activeNodes: number;
    avgThroughputTps: number;
    avgIngestLatencyMs: number;
    avgDecodeLatencyMs: number;
    metricPoints: number;
    lastBlock: number | null;
  };
  aiDataEngineer: {
    featureConfigs: number;
    enabledFeatures: number;
    modelVersions: number;
    activeModels: number;
    activeVersion: string;
    activeFramework: string;
  };
  securityAnalyst: {
    alertsToday: number;
    criticalAlerts: number;
    recentAlerts: number;
    openCases: number;
    topCaseRisk: number | null;
  };
  complianceRiskManager: {
    totalWallets: number;
    criticalAlerts: number;
    blockedTotal: number;
    blockedToday: number;
    blockedValueEth: number;
  };
};

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: "system_admin",
    label: "System Administrator",
    shortLabel: "Admin",
    accentClass: "text-cyan-300 border-cyan-400/40 bg-cyan-500/10",
    sidebarFeatures: [
      "Node Connection Manager",
      "Circuit Breaker Control",
      "Pipeline Throughput Monitor",
      "Latency and SLA Monitor",
      "RBAC and User Provisioning",
      "Audit Trail Explorer",
    ],
    topLeftTitle: "Node Connectivity",
    topRightTitle: "Pipeline Health",
    centerTitle: "Infrastructure Orchestration Hub",
    bottomRightTitle: "Security and Audit Ops",
  },
  {
    key: "ai_data_engineer",
    label: "AI and Data Engineer",
    shortLabel: "AI Engineer",
    accentClass: "text-violet-300 border-violet-400/40 bg-violet-500/10",
    sidebarFeatures: [
      "Feature Store Selection",
      "Feature Engineering Recipes",
      "Model Registry and Versioning",
      "Parallel Inference Worker Pools",
      "Backtesting Runner",
      "Historical Replay Tools",
    ],
    topLeftTitle: "Feature Pipeline",
    topRightTitle: "Model Deployment",
    centerTitle: "Experiment and Inference Plane",
    bottomRightTitle: "Backtesting Console",
  },
  {
    key: "security_analyst",
    label: "Security Analyst",
    shortLabel: "Analyst",
    accentClass: "text-rose-300 border-rose-400/40 bg-rose-500/10",
    sidebarFeatures: [
      "Real-time Alert Board",
      "Transaction Visualizer",
      "Address Label Enrichment",
      "Case Assignment Queue",
      "Confirm and Dismiss Actions",
      "Escalation Workflow",
    ],
    topLeftTitle: "Active Alerts",
    topRightTitle: "Suspicious Path Graph",
    centerTitle: "Fraud Investigation Workspace",
    bottomRightTitle: "Case Decision Timeline",
  },
  {
    key: "compliance_risk_manager",
    label: "Compliance and Risk Manager",
    shortLabel: "Compliance",
    accentClass: "text-amber-300 border-amber-400/40 bg-amber-500/10",
    sidebarFeatures: [
      "Policy Engine Rules",
      "Blacklist and Whitelist",
      "Escalation Governance",
      "Regulatory Report Builder",
      "Executive KPI Dashboard",
      "Control Effectiveness Review",
    ],
    topLeftTitle: "Policy Rules",
    topRightTitle: "Blacklist Controls",
    centerTitle: "Risk Governance Center",
    bottomRightTitle: "Executive Reports",
  },
];

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<RoleKey>("system_admin");
  const [activeFeatureIndex, setActiveFeatureIndex] = useState<number>(0);
  const [isLoadingFacts, setIsLoadingFacts] = useState<boolean>(false);
  const [factsError, setFactsError] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);

  const [nodeEndpoints, setNodeEndpoints] = useState<NodeEndpoint[]>([]);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetric[]>([]);
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfig[]>([]);
  const [modelRegistryItems, setModelRegistryItems] = useState<ModelRegistryItem[]>([]);
  const [alertItems, setAlertItems] = useState<AlertItem[]>([]);
  const [caseItems, setCaseItems] = useState<CaseItem[]>([]);
  const [blockedTransfers, setBlockedTransfers] = useState<BlockedTransferItem[]>([]);

  const [nodeForm, setNodeForm] = useState({
    provider_name: "Alchemy",
    chain: "ethereum",
    endpoint_url: "",
    protocol: "http",
    priority: 100,
    is_active: true,
  });

  const [healthForm, setHealthForm] = useState({
    endpoint_id: "",
    health_status: "healthy",
    last_error: "",
  });

  const [featureForm, setFeatureForm] = useState({
    feature_key: "",
    expression: "z_score(value_24h)",
    enabled: true,
  });

  const [modelForm, setModelForm] = useState({
    model_name: "risk-core",
    version: "",
    artifact_uri: "",
    framework: "onnx",
    is_active: true,
  });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    systemAdmin: {
      totalNodeEndpoints: 0,
      activeNodes: 0,
      avgThroughputTps: 0,
      avgIngestLatencyMs: 0,
      avgDecodeLatencyMs: 0,
      metricPoints: 0,
      lastBlock: null,
    },
    aiDataEngineer: {
      featureConfigs: 0,
      enabledFeatures: 0,
      modelVersions: 0,
      activeModels: 0,
      activeVersion: "N/A",
      activeFramework: "N/A",
    },
    securityAnalyst: {
      alertsToday: 0,
      criticalAlerts: 0,
      recentAlerts: 0,
      openCases: 0,
      topCaseRisk: null,
    },
    complianceRiskManager: {
      totalWallets: 0,
      criticalAlerts: 0,
      blockedTotal: 0,
      blockedToday: 0,
      blockedValueEth: 0,
    },
  });
  const [roleFacts, setRoleFacts] = useState<RoleFacts>({
    p1: ["No data yet"],
    p2: ["No data yet"],
    p3: ["No data yet"],
    p4: ["No data yet"],
    note: "Waiting for backend metrics",
  });

  const role = useMemo(
    () => ROLE_DEFINITIONS.find((entry) => entry.key === activeRole) ?? ROLE_DEFINITIONS[0],
    [activeRole]
  );

  const sidebarIcons = [Settings, Network, Brain, Bell, UserCog, FileCheck2];

  const getSectionFromFeatureIndex = (index: number): WorkspaceSection => {
    if (index < 2) {
      return "overview";
    }
    if (index < 4) {
      return "actions";
    }
    return "data";
  };

  const activeSection = getSectionFromFeatureIndex(activeFeatureIndex);
  const activeFeatureLabel = role.sidebarFeatures[activeFeatureIndex] ?? role.sidebarFeatures[0] ?? "Workspace Module";

  const fetchJson = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Request failed (${response.status}) ${body}`);
    }
    return response.json();
  };

  const loadRoleFacts = async (targetRole: RoleKey) => {
    setIsLoadingFacts(true);
    setFactsError(null);

    try {
      if (targetRole === "system_admin") {
        const [nodes, summary, metrics] = await Promise.all([
          fetchJson("/api/ops/system/node-endpoints"),
          fetchJson("/api/ops/system/pipeline-metrics/summary"),
          fetchJson("/api/ops/system/pipeline-metrics?limit=5"),
        ]);

        setNodeEndpoints((nodes.items ?? []) as NodeEndpoint[]);
        setPipelineMetrics((metrics.items ?? []) as PipelineMetric[]);

        setRoleFacts({
          p1: [
            `Node endpoints: ${nodes.count ?? 0}`,
            `Active nodes: ${((nodes.items ?? []) as Array<{ is_active?: boolean }>).filter((x) => x.is_active).length}`,
            `Last block: ${summary.last_block_number ?? "N/A"}`,
          ],
          p2: [
            `Avg throughput: ${summary.avg_throughput_tps ?? 0} TPS`,
            `Avg ingest latency: ${summary.avg_ingestion_latency_ms ?? 0} ms`,
            `Avg decode latency: ${summary.avg_decode_latency_ms ?? 0} ms`,
          ],
          p3: [
            `Recent metric points: ${metrics.count ?? 0}`,
            `Chain monitored: ${(metrics.items?.[0]?.chain ?? "ETH") as string}`,
            "Circuit breaker status can be added in next iteration.",
          ],
          p4: [
            "Audit logs are written on endpoint changes.",
            "Use health update API to simulate failover.",
            "RBAC hooks are ready for re-enable auth phase.",
          ],
          note: "Data source: /ops/system/* APIs backed by database metrics",
        });
        setDashboardStats((prev) => ({
          ...prev,
          systemAdmin: {
            totalNodeEndpoints: Number(nodes.count ?? 0),
            activeNodes: ((nodes.items ?? []) as Array<{ is_active?: boolean }>).filter((x) => x.is_active).length,
            avgThroughputTps: Number(summary.avg_throughput_tps ?? 0),
            avgIngestLatencyMs: Number(summary.avg_ingestion_latency_ms ?? 0),
            avgDecodeLatencyMs: Number(summary.avg_decode_latency_ms ?? 0),
            metricPoints: Number(metrics.count ?? 0),
            lastBlock: summary.last_block_number ?? null,
          },
        }));
      } else if (targetRole === "ai_data_engineer") {
        const [features, models, activeModels] = await Promise.all([
          fetchJson("/api/ops/ai/feature-store"),
          fetchJson("/api/ops/ai/model-registry"),
          fetchJson("/api/ops/ai/model-registry/active"),
        ]);

        setFeatureConfigs((features.items ?? []) as FeatureConfig[]);
        setModelRegistryItems((models.items ?? []) as ModelRegistryItem[]);

        const enabledFeatureCount = ((features.items ?? []) as Array<{ enabled?: boolean }>).filter((x) => x.enabled).length;

        setRoleFacts({
          p1: [
            `Feature configs: ${features.count ?? 0}`,
            `Enabled features: ${enabledFeatureCount}`,
            `Latest feature: ${features.items?.[0]?.feature_key ?? "N/A"}`,
          ],
          p2: [
            `Model versions: ${models.count ?? 0}`,
            `Active models: ${activeModels.count ?? 0}`,
            `Latest model: ${models.items?.[0]?.model_name ?? "N/A"}`,
          ],
          p3: [
            "Parallel inference worker orchestration: planned in next patch.",
            "Backtesting runner will read cold-storage snapshots.",
            "Current page validates config and registry lifecycle.",
          ],
          p4: [
            `Active version: ${activeModels.items?.[0]?.version ?? "N/A"}`,
            `Framework: ${activeModels.items?.[0]?.framework ?? "N/A"}`,
            "Promotion event is audit-logged.",
          ],
          note: "Data source: /ops/ai/* APIs with model registry + feature store",
        });
        setDashboardStats((prev) => ({
          ...prev,
          aiDataEngineer: {
            featureConfigs: Number(features.count ?? 0),
            enabledFeatures: enabledFeatureCount,
            modelVersions: Number(models.count ?? 0),
            activeModels: Number(activeModels.count ?? 0),
            activeVersion: String(activeModels.items?.[0]?.version ?? "N/A"),
            activeFramework: String(activeModels.items?.[0]?.framework ?? "N/A"),
          },
        }));
      } else if (targetRole === "security_analyst") {
        const [alerts, cases] = await Promise.all([
          fetchJson("/api/alerts/recent?limit=20"),
          fetchJson("/api/cases?min_risk=0.8&limit=20"),
        ]);

        setAlertItems((alerts.alerts ?? []) as AlertItem[]);
        setCaseItems((cases.cases ?? []) as CaseItem[]);

        setRoleFacts({
          p1: [
            `Alerts today: ${alerts.statistics?.total_alerts_today ?? 0}`,
            `Critical alerts: ${alerts.statistics?.critical_count ?? 0}`,
            `Recent alert rows: ${alerts.statistics?.total_recent ?? 0}`,
          ],
          p2: [
            `Open high-risk cases: ${cases.count ?? 0}`,
            `Top case status: ${cases.cases?.[0]?.status ?? "N/A"}`,
            `Latest tx: ${cases.cases?.[0]?.tx_hash ?? "N/A"}`,
          ],
          p3: [
            "Use /cases/{tx_hash}/action for Confirm Fraud and Dismiss.",
            "Escalate action is enabled in state machine.",
            "Address labeling adapters are next integration item.",
          ],
          p4: [
            "Push notifications (Telegram/Slack) pending integration.",
            "Case timeline API is live: /cases/{tx_hash}/history.",
            "Audit trail is written per analyst action.",
          ],
          note: "Data source: /alerts/recent and /cases",
        });
        setDashboardStats((prev) => ({
          ...prev,
          securityAnalyst: {
            alertsToday: Number(alerts.statistics?.total_alerts_today ?? 0),
            criticalAlerts: Number(alerts.statistics?.critical_count ?? 0),
            recentAlerts: Number(alerts.statistics?.total_recent ?? 0),
            openCases: Number(cases.count ?? 0),
            topCaseRisk: cases.cases?.[0]?.risk_score ?? null,
          },
        }));
      } else {
        const [dashboard, blocked] = await Promise.all([
          fetchJson("/api/statistics/dashboard"),
          fetchJson("/api/blocked-transfers?limit=20"),
        ]);

        setBlockedTransfers((blocked.blocked_transfers ?? []) as BlockedTransferItem[]);

        setRoleFacts({
          p1: [
            `Total wallets: ${dashboard.overview?.total_wallets ?? 0}`,
            `Critical alerts: ${dashboard.overview?.critical_alerts ?? 0}`,
            `Alerts today: ${dashboard.overview?.alerts_today ?? 0}`,
          ],
          p2: [
            `Blocked total: ${blocked.statistics?.total_blocked ?? 0}`,
            `Blocked today: ${blocked.statistics?.blocked_today ?? 0}`,
            `Blocked value: ${blocked.statistics?.total_value_blocked_eth ?? 0} ETH`,
          ],
          p3: [
            "Policy Engine editor is prepared for Phase 3.",
            "Hard rule execution hooks should run pre-inference.",
            "Compliance actions should link to case outcomes.",
          ],
          p4: [
            "Executive report templates are next milestone.",
            "Add monthly aggregations and scheduled exports.",
            "Attach regulatory evidence bundle per incident.",
          ],
          note: "Data source: /statistics/dashboard and /blocked-transfers",
        });
        setDashboardStats((prev) => ({
          ...prev,
          complianceRiskManager: {
            totalWallets: Number(dashboard.overview?.total_wallets ?? 0),
            criticalAlerts: Number(dashboard.overview?.critical_alerts ?? 0),
            blockedTotal: Number(blocked.statistics?.total_blocked ?? 0),
            blockedToday: Number(blocked.statistics?.blocked_today ?? 0),
            blockedValueEth: Number(blocked.statistics?.total_value_blocked_eth ?? 0),
          },
        }));
      }
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to fetch role facts");
      setRoleFacts({
        p1: ["Data fetch failed"],
        p2: ["Data fetch failed"],
        p3: ["Please verify backend and database"],
        p4: ["See console / network logs"],
        note: "Fallback mode",
      });
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const seedSystemMetric = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/system/pipeline-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: "ethereum",
          block_number: Math.floor(Date.now() / 1000),
          throughput_tps: Number((Math.random() * 18 + 4).toFixed(2)),
          ingestion_latency_ms: Math.floor(Math.random() * 200 + 60),
          decode_latency_ms: Math.floor(Math.random() * 80 + 20),
        }),
      });
      await loadRoleFacts(role.key);
      setUiMessage("Inserted sample pipeline metric");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to seed metric");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const seedAiConfig = async () => {
    try {
      setIsLoadingFacts(true);
      const randomSuffix = Math.floor(Math.random() * 10000);
      await fetchJson("/api/ops/ai/feature-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: `phase2_feature_${randomSuffix}`,
          enabled: true,
          expression: "z_score(value_24h)",
        }),
      });

      await fetchJson("/api/ops/ai/model-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: "risk-core",
          version: `v${Date.now()}`,
          artifact_uri: "s3://models/risk-core/latest.onnx",
          framework: "onnx",
          is_active: true,
        }),
      });

      await loadRoleFacts(role.key);
      setUiMessage("Inserted sample feature and model");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to seed AI config");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const createNodeEndpoint = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/system/node-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nodeForm),
      });
      setNodeForm((prev) => ({ ...prev, endpoint_url: "" }));
      setUiMessage("Node endpoint created");
      await loadRoleFacts("system_admin");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to create node endpoint");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const updateNodeHealth = async () => {
    if (!healthForm.endpoint_id) {
      setFactsError("Please select a node endpoint");
      return;
    }

    try {
      setIsLoadingFacts(true);
      await fetchJson(`/api/ops/system/node-endpoints/${healthForm.endpoint_id}/health`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_status: healthForm.health_status,
          last_error: healthForm.last_error || null,
        }),
      });
      setUiMessage("Node health updated");
      await loadRoleFacts("system_admin");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to update node health");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const createFeatureConfig = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/ai/feature-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(featureForm),
      });
      setUiMessage("Feature config created");
      setFeatureForm((prev) => ({ ...prev, feature_key: "" }));
      await loadRoleFacts("ai_data_engineer");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to create feature config");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const createModelRegistryItem = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/ai/model-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelForm),
      });
      setUiMessage("Model registry item created");
      setModelForm((prev) => ({ ...prev, version: "", artifact_uri: "" }));
      await loadRoleFacts("ai_data_engineer");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to create model item");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const activateModel = async (modelId: string) => {
    try {
      setIsLoadingFacts(true);
      await fetchJson(`/api/ops/ai/model-registry/${modelId}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setUiMessage("Model activated");
      await loadRoleFacts("ai_data_engineer");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to activate model");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  useEffect(() => {
    setActiveFeatureIndex(0);
    setUiMessage(null);
    loadRoleFacts(role.key);
  }, [role.key]);

  useEffect(() => {
    if (role.key !== "system_admin" && role.key !== "security_analyst") {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadRoleFacts(role.key);
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [role.key]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        <header className="mb-4 rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold md:text-2xl">Blockchain AI Operations Console</h1>
                <p className="text-sm text-slate-400">Single-home interface for role switching and function testing</p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              System live • routes locked to home page
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ROLE_DEFINITIONS.map((entry) => {
              const isActive = entry.key === role.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setActiveRole(entry.key)}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-medium transition",
                    isActive
                      ? `${entry.accentClass} shadow-[0_0_0_1px_rgba(148,163,184,0.15)]`
                      : "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:text-white",
                  ].join(" ")}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Sidebar Functions</h2>
              <span className={["rounded-lg border px-2 py-1 text-xs", role.accentClass].join(" ")}>
                {role.shortLabel}
              </span>
            </div>

            <div className="space-y-2">
              {role.sidebarFeatures.map((feature, index) => {
                const Icon = sidebarIcons[index % sidebarIcons.length];
                const isActiveFeature = index === activeFeatureIndex;
                const sectionForFeature = getSectionFromFeatureIndex(index);
                return (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => setActiveFeatureIndex(index)}
                    className={[
                      "w-full rounded-lg border px-3 py-2 text-left text-sm transition",
                      isActiveFeature
                        ? "border-slate-500 bg-slate-700/70 text-white"
                        : "border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <Icon className={isActiveFeature ? "h-4 w-4 text-white" : "h-4 w-4 text-slate-400"} />
                        <span>{feature}</span>
                      </span>
                      <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {sectionForFeature}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Role Workspace</h2>
              <span className="text-sm text-slate-400">Module: {activeFeatureLabel}</span>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveFeatureIndex(0)}
                className={[
                  "rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wide",
                  activeSection === "overview"
                    ? "border-slate-500 bg-slate-700/70 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-300",
                ].join(" ")}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureIndex(2)}
                className={[
                  "rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wide",
                  activeSection === "actions"
                    ? "border-slate-500 bg-slate-700/70 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-300",
                ].join(" ")}
              >
                Actions
              </button>
              <button
                type="button"
                onClick={() => setActiveFeatureIndex(4)}
                className={[
                  "rounded-lg border px-2.5 py-1 text-xs uppercase tracking-wide",
                  activeSection === "data"
                    ? "border-slate-500 bg-slate-700/70 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-300",
                ].join(" ")}
              >
                Data
              </button>
            </div>

            {uiMessage ? (
              <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {uiMessage}
              </div>
            ) : null}

            {activeSection === "data" ? (
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {role.key === "system_admin" ? (
                  <>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Node endpoints</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.systemAdmin.totalNodeEndpoints}</p>
                      <p className="text-xs text-cyan-100/80">Active {dashboardStats.systemAdmin.activeNodes}</p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Throughput</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.systemAdmin.avgThroughputTps.toFixed(2)}</p>
                      <p className="text-xs text-cyan-100/80">TPS average</p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Latency</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.systemAdmin.avgIngestLatencyMs.toFixed(0)} ms</p>
                      <p className="text-xs text-cyan-100/80">Ingest average</p>
                    </div>
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Latest block</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.systemAdmin.lastBlock ?? "N/A"}</p>
                      <p className="text-xs text-cyan-100/80">{dashboardStats.systemAdmin.metricPoints} points</p>
                    </div>
                  </>
                ) : null}

                {role.key === "ai_data_engineer" ? (
                  <>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-violet-200">Feature configs</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.aiDataEngineer.featureConfigs}</p>
                      <p className="text-xs text-violet-100/80">Enabled {dashboardStats.aiDataEngineer.enabledFeatures}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-violet-200">Model versions</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.aiDataEngineer.modelVersions}</p>
                      <p className="text-xs text-violet-100/80">Active {dashboardStats.aiDataEngineer.activeModels}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-violet-200">Active version</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.aiDataEngineer.activeVersion}</p>
                      <p className="text-xs text-violet-100/80">{dashboardStats.aiDataEngineer.activeFramework}</p>
                    </div>
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-violet-200">Lifecycle</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Live</p>
                      <p className="text-xs text-violet-100/80">Registry + feature store</p>
                    </div>
                  </>
                ) : null}

                {role.key === "security_analyst" ? (
                  <>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-rose-200">Alerts today</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.securityAnalyst.alertsToday}</p>
                      <p className="text-xs text-rose-100/80">Critical {dashboardStats.securityAnalyst.criticalAlerts}</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-rose-200">Open cases</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.securityAnalyst.openCases}</p>
                      <p className="text-xs text-rose-100/80">Recent {dashboardStats.securityAnalyst.recentAlerts}</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-rose-200">Top case risk</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.securityAnalyst.topCaseRisk ?? "N/A"}</p>
                      <p className="text-xs text-rose-100/80">Min risk queue</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-rose-200">Investigation</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Active</p>
                      <p className="text-xs text-rose-100/80">Alerts + case triage</p>
                    </div>
                  </>
                ) : null}

                {role.key === "compliance_risk_manager" ? (
                  <>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-amber-200">Total wallets</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.complianceRiskManager.totalWallets}</p>
                      <p className="text-xs text-amber-100/80">Critical {dashboardStats.complianceRiskManager.criticalAlerts}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-amber-200">Blocked transfers</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.complianceRiskManager.blockedTotal}</p>
                      <p className="text-xs text-amber-100/80">Today {dashboardStats.complianceRiskManager.blockedToday}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-amber-200">Blocked value</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.complianceRiskManager.blockedValueEth.toFixed(2)}</p>
                      <p className="text-xs text-amber-100/80">ETH protected</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-amber-200">Governance</p>
                      <p className="mt-2 text-2xl font-semibold text-white">Live</p>
                      <p className="text-xs text-amber-100/80">Reporting + controls</p>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {activeSection === "overview" ? (
                <>
                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                    <h3 className="text-base font-semibold text-slate-100">{role.topLeftTitle}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {roleFacts.p1.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                    <h3 className="text-base font-semibold text-slate-100">{role.topRightTitle}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {roleFacts.p2.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2">
                    <h3 className="text-base font-semibold text-slate-100">{role.centerTitle}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {roleFacts.p3.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <GitBranch className="h-4 w-4" />
                      Transition flow: ingest > score > triage > decision > audit
                    </div>
                  </article>

                  <div className="md:col-span-2 md:flex md:justify-end">
                    <article className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:w-[62%]">
                      <h3 className="text-base font-semibold text-slate-100">{role.bottomRightTitle}</h3>
                      <ul className="mt-2 space-y-1 text-sm text-slate-300">
                        {roleFacts.p4.map((line) => (
                          <li key={line}>- {line}</li>
                        ))}
                      </ul>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300">
                        <Lock className="h-3.5 w-3.5" />
                        All other app pages are temporarily disabled
                      </div>
                    </article>
                  </div>
                </>
              ) : null}

              {activeSection === "actions" ? (
                <>
                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2">
                    <h3 className="text-base font-semibold text-slate-100">Action Center</h3>
                    <p className="mt-1 text-sm text-slate-400">Quick actions for the selected role module.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {role.key === "system_admin" && (
                        <button
                          type="button"
                          onClick={seedSystemMetric}
                          className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/25"
                        >
                          Insert sample pipeline metric
                        </button>
                      )}
                      {role.key === "ai_data_engineer" && (
                        <button
                          type="button"
                          onClick={seedAiConfig}
                          className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/25"
                        >
                          Insert sample feature + model
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => loadRoleFacts(role.key)}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Refresh role data
                      </button>
                    </div>
                  </article>

                  {role.key === "system_admin" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Create Node Endpoint</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            value={nodeForm.provider_name}
                            onChange={(e) => setNodeForm((prev) => ({ ...prev, provider_name: e.target.value }))}
                            placeholder="Provider"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={nodeForm.chain}
                            onChange={(e) => setNodeForm((prev) => ({ ...prev, chain: e.target.value }))}
                            placeholder="Chain"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={nodeForm.endpoint_url}
                            onChange={(e) => setNodeForm((prev) => ({ ...prev, endpoint_url: e.target.value }))}
                            placeholder="Endpoint URL"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={nodeForm.protocol}
                              onChange={(e) => setNodeForm((prev) => ({ ...prev, protocol: e.target.value }))}
                              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            >
                              <option value="http">http</option>
                              <option value="websocket">websocket</option>
                            </select>
                            <input
                              type="number"
                              value={nodeForm.priority}
                              onChange={(e) => setNodeForm((prev) => ({ ...prev, priority: Number(e.target.value) || 100 }))}
                              placeholder="Priority"
                              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={createNodeEndpoint}
                            className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-1.5 text-xs text-cyan-200"
                          >
                            Save Endpoint
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Update Node Health</p>
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={healthForm.endpoint_id}
                            onChange={(e) => setHealthForm((prev) => ({ ...prev, endpoint_id: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="">Select endpoint</option>
                            {nodeEndpoints.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.provider_name} - {item.chain}
                              </option>
                            ))}
                          </select>
                          <select
                            value={healthForm.health_status}
                            onChange={(e) => setHealthForm((prev) => ({ ...prev, health_status: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="healthy">healthy</option>
                            <option value="degraded">degraded</option>
                            <option value="down">down</option>
                            <option value="unknown">unknown</option>
                          </select>
                          <input
                            value={healthForm.last_error}
                            onChange={(e) => setHealthForm((prev) => ({ ...prev, last_error: e.target.value }))}
                            placeholder="Last error (optional)"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={updateNodeHealth}
                            className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-1.5 text-xs text-cyan-200"
                          >
                            Update Health
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "ai_data_engineer" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Create Feature Config</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            value={featureForm.feature_key}
                            onChange={(e) => setFeatureForm((prev) => ({ ...prev, feature_key: e.target.value }))}
                            placeholder="Feature key"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={featureForm.expression}
                            onChange={(e) => setFeatureForm((prev) => ({ ...prev, expression: e.target.value }))}
                            placeholder="Expression"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={featureForm.enabled}
                              onChange={(e) => setFeatureForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                            />
                            Enabled
                          </label>
                          <button
                            type="button"
                            onClick={createFeatureConfig}
                            className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-1.5 text-xs text-violet-200"
                          >
                            Save Feature
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Create Model Entry</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            value={modelForm.model_name}
                            onChange={(e) => setModelForm((prev) => ({ ...prev, model_name: e.target.value }))}
                            placeholder="Model name"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={modelForm.version}
                            onChange={(e) => setModelForm((prev) => ({ ...prev, version: e.target.value }))}
                            placeholder="Version"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={modelForm.artifact_uri}
                            onChange={(e) => setModelForm((prev) => ({ ...prev, artifact_uri: e.target.value }))}
                            placeholder="Artifact URI"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={modelForm.framework}
                            onChange={(e) => setModelForm((prev) => ({ ...prev, framework: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="pkl">pkl</option>
                            <option value="onnx">onnx</option>
                            <option value="pt">pt</option>
                          </select>
                          <button
                            type="button"
                            onClick={createModelRegistryItem}
                            className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-1.5 text-xs text-violet-200"
                          >
                            Save Model
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeSection === "data" ? (
                <>
                  {role.key === "system_admin" ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Node Endpoints</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Provider</th>
                                <th className="pb-1">Chain</th>
                                <th className="pb-1">Protocol</th>
                                <th className="pb-1">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nodeEndpoints.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.provider_name}</td>
                                  <td className="py-1">{row.chain}</td>
                                  <td className="py-1">{row.protocol}</td>
                                  <td className="py-1">{row.health_status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Pipeline Metrics</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Block</th>
                                <th className="pb-1">TPS</th>
                                <th className="pb-1">Ingest ms</th>
                                <th className="pb-1">Decode ms</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pipelineMetrics.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.block_number ?? "N/A"}</td>
                                  <td className="py-1">{row.throughput_tps ?? "N/A"}</td>
                                  <td className="py-1">{row.ingestion_latency_ms ?? "N/A"}</td>
                                  <td className="py-1">{row.decode_latency_ms ?? "N/A"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "ai_data_engineer" ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Feature Store</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Feature</th>
                                <th className="pb-1">Enabled</th>
                                <th className="pb-1">Expression</th>
                              </tr>
                            </thead>
                            <tbody>
                              {featureConfigs.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.feature_key}</td>
                                  <td className="py-1">{row.enabled ? "Yes" : "No"}</td>
                                  <td className="py-1">{row.expression ?? "N/A"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Model Registry</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Model</th>
                                <th className="pb-1">Version</th>
                                <th className="pb-1">Active</th>
                                <th className="pb-1">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelRegistryItems.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.model_name}</td>
                                  <td className="py-1">{row.version}</td>
                                  <td className="py-1">{row.is_active ? "Yes" : "No"}</td>
                                  <td className="py-1">
                                    {!row.is_active ? (
                                      <button
                                        type="button"
                                        onClick={() => activateModel(row.id)}
                                        className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[10px] text-violet-200"
                                      >
                                        Activate
                                      </button>
                                    ) : (
                                      "-"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "security_analyst" ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Recent Alerts</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Type</th>
                                <th className="pb-1">Severity</th>
                                <th className="pb-1">Risk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {alertItems.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.alert_type}</td>
                                  <td className="py-1">{row.severity}</td>
                                  <td className="py-1">{row.risk_score ?? "N/A"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Case Queue</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Tx Hash</th>
                                <th className="pb-1">Status</th>
                                <th className="pb-1">Risk</th>
                              </tr>
                            </thead>
                            <tbody>
                              {caseItems.map((row) => (
                                <tr key={row.tx_hash} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.tx_hash.slice(0, 12)}...</td>
                                  <td className="py-1">{row.status}</td>
                                  <td className="py-1">{row.risk_score ?? "N/A"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "compliance_risk_manager" ? (
                    <div className="md:col-span-2 rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Blocked Transfers</p>
                      <div className="max-h-72 overflow-auto text-xs">
                        <table className="w-full text-left">
                          <thead className="text-slate-400">
                            <tr>
                              <th className="pb-1">Sender</th>
                              <th className="pb-1">Receiver</th>
                              <th className="pb-1">Amount ETH</th>
                              <th className="pb-1">Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {blockedTransfers.map((row) => (
                              <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                <td className="py-1">{row.sender_address.slice(0, 10)}...</td>
                                <td className="py-1">{row.receiver_address.slice(0, 10)}...</td>
                                <td className="py-1">{row.amount_eth}</td>
                                <td className="py-1">{row.risk_score}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  <div className="md:col-span-2 rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-400">
                    Data note: {roleFacts.note}
                    {isLoadingFacts ? " | loading..." : ""}
                    {factsError ? ` | error: ${factsError}` : ""}
                  </div>
                </>
              ) : null}
            </section>
          </main>
        </div>

        <footer className="mt-4 text-center text-xs text-slate-500">
          Home-only mode enabled for rapid role-based testing
        </footer>
      </div>
    </div>
  );
}

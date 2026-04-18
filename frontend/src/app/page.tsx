"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
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
  const [isLoadingFacts, setIsLoadingFacts] = useState<boolean>(false);
  const [factsError, setFactsError] = useState<string | null>(null);
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
      } else if (targetRole === "ai_data_engineer") {
        const [features, models, activeModels] = await Promise.all([
          fetchJson("/api/ops/ai/feature-store"),
          fetchJson("/api/ops/ai/model-registry"),
          fetchJson("/api/ops/ai/model-registry/active"),
        ]);

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
      } else if (targetRole === "security_analyst") {
        const [alerts, cases] = await Promise.all([
          fetchJson("/api/alerts/recent?limit=20"),
          fetchJson("/api/cases?min_risk=0.8&limit=20"),
        ]);

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
      } else {
        const [dashboard, blocked] = await Promise.all([
          fetchJson("/api/statistics/dashboard"),
          fetchJson("/api/blocked-transfers?limit=20"),
        ]);

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
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to seed AI config");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  useEffect(() => {
    loadRoleFacts(role.key);
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
                return (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-300"
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span>{feature}</span>
                  </div>
                );
              })}
            </div>
          </aside>

          <main className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Role Workspace</h2>
              <span className="text-sm text-slate-400">Content organized in Z-layout</span>
            </div>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 1</p>
                <h3 className="text-base font-semibold text-slate-100">{role.topLeftTitle}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {roleFacts.p1.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 2</p>
                <h3 className="text-base font-semibold text-slate-100">{role.topRightTitle}</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {roleFacts.p2.map((line) => (
                    <li key={line}>- {line}</li>
                  ))}
                </ul>
              </article>

              <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 3</p>
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

              <div className="md:col-span-2 md:flex md:justify-end">
                <article className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:w-[62%]">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 4</p>
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

              <div className="md:col-span-2 rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-400">
                Data note: {roleFacts.note}
                {isLoadingFacts ? " | loading..." : ""}
                {factsError ? ` | error: ${factsError}` : ""}
              </div>
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

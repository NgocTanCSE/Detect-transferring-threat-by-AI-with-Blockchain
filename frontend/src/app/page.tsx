"use client";

import { useMemo, useState } from "react";
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

  const role = useMemo(
    () => ROLE_DEFINITIONS.find((entry) => entry.key === activeRole) ?? ROLE_DEFINITIONS[0],
    [activeRole]
  );

  const sidebarIcons = [Settings, Network, Brain, Bell, UserCog, FileCheck2];

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
                <p className="mt-2 text-sm text-slate-300">
                  Khung hiển thị số liệu trọng tâm góc trái trên. Bạn có thể bind dữ liệu trực tiếp từ backend gọi Alchemy real-time.
                </p>
              </article>

              <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 2</p>
                <h3 className="text-base font-semibold text-slate-100">{role.topRightTitle}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Khối theo dõi trạng thái luồng nhanh hoặc cảnh báo. Đây là điểm đọc thứ hai của bố cục chữ Z.
                </p>
              </article>

              <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2">
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 3</p>
                <h3 className="text-base font-semibold text-slate-100">{role.centerTitle}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Khu vực nội dung chính đặt theo đường chéo thị giác, chứa bảng xử lý nghiệp vụ, timeline hoặc graph tùy role.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <GitBranch className="h-4 w-4" />
                  Transition flow: ingest > score > triage > decision > audit
                </div>
              </article>

              <div className="md:col-span-2 md:flex md:justify-end">
                <article className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:w-[62%]">
                  <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Z Point 4</p>
                  <h3 className="text-base font-semibold text-slate-100">{role.bottomRightTitle}</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Ô quyết định cuối luồng chữ Z. Ưu tiên hiển thị hành động cuối cùng, outcome và tác động hệ thống.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300">
                    <Lock className="h-3.5 w-3.5" />
                    All other app pages are temporarily disabled
                  </div>
                </article>
              </div>

              <div className="md:col-span-2 rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-400">
                Data note: Database lưu dữ liệu hệ thống dài hạn. Phần hiển thị có thể lấy trực tiếp từ Alchemy hoặc qua backend cache tùy use-case.
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

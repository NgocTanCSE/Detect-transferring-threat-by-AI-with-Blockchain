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

type ModuleBlueprint = {
  title: string;
  subtitle: string;
  status: string;
  objective: string;
  metrics: Array<{ label: string; value: string; tone: string }>;
  signals: string[];
  actions: string[];
  notes: string[];
};

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
};

type NotificationEventItem = {
  id: string;
  channel: string;
  recipient: string;
  severity: string;
  message: string;
  status: string;
  created_at: string | null;
};

type CaseSummary = {
  totals: {
    PENDING: number;
    VERIFIED: number;
    FRAUD: number;
    IGNORED: number;
  };
  unassigned: number;
  high_risk_unassigned: number;
};

type ComplianceReportSummary = {
  period: {
    days: number;
    start: string;
    end: string;
  };
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
  cases: {
    PENDING: number;
    VERIFIED: number;
    FRAUD: number;
    IGNORED: number;
  };
};

type ComplianceEffectiveness = {
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

type ComplianceExportPayload = {
  generated_at: string;
  filename: string;
  rows: Array<{ metric: string; value: string }>;
  csv: string;
};

type SystemSloMetrics = {
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

type ComplianceAuditGaps = {
  period_days: number;
  missing_count: number;
  missing_actions: Array<{
    action_type: string;
    owner_role: string;
    reason: string;
    recommended_next_step: string;
  }>;
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
    pendingCases: number;
    fraudCases: number;
    notificationEvents: number;
  };
  complianceRiskManager: {
    totalWallets: number;
    criticalAlerts: number;
    blockedTotal: number;
    blockedToday: number;
    blockedValueEth: number;
    activePolicyRules: number;
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

const MODULE_BLUEPRINTS: Record<RoleKey, ModuleBlueprint[]> = {
  system_admin: [
    {
      title: "Node Connection Manager",
      subtitle: "Control Alchemy / node failover and endpoint health.",
      status: "Operational",
      objective: "Keep chain access reliable and visible.",
      metrics: [
        { label: "Endpoint pool", value: "Live", tone: "cyan" },
        { label: "Failover", value: "Ready", tone: "emerald" },
        { label: "Health checks", value: "8s", tone: "blue" },
      ],
      signals: ["Primary RPC path healthy", "Auto-failover supported", "Endpoint list persisted in DB"],
      actions: ["Add endpoint", "Update health", "Toggle active node"],
      notes: ["This module owns external chain connectivity.", "Used by analysis, scanner, and dashboard refresh loops."],
    },
    {
      title: "Pipeline Observability",
      subtitle: "Watch throughput, ingest latency, and decode latency.",
      status: "Observed",
      objective: "Surface operational drag before analysis stalls.",
      metrics: [
        { label: "Throughput", value: "TPS", tone: "violet" },
        { label: "Latency", value: "ms", tone: "amber" },
        { label: "Blocks", value: "Recent", tone: "rose" },
      ],
      signals: ["Metrics stored in pipeline_metrics", "Summary endpoint available", "Recent points loaded live"],
      actions: ["Review metric trend", "Refresh summary", "Inspect recent rows"],
      notes: ["This is the system health dashboard layer.", "Supports long-running runtime monitoring."],
    },
    {
      title: "RBAC and User Provisioning",
      subtitle: "Plan role access and user lifecycle controls.",
      status: "Planned",
      objective: "Preserve inheritance while role-based UI stays active.",
      metrics: [
        { label: "Users", value: "Future", tone: "slate" },
        { label: "Roles", value: "4", tone: "slate" },
        { label: "MFA", value: "Phase 4", tone: "slate" },
      ],
      signals: ["Auth is currently disabled", "UI role switch is local", "Backend auth router remains in place"],
      actions: ["Re-enable auth", "Bind role enums", "Add admin provisioning"],
      notes: ["This is a roadmap item, not live auth yet."],
    },
    {
      title: "Audit Trail Explorer",
      subtitle: "Track write events and operational changes.",
      status: "Live",
      objective: "Keep every operational change traceable.",
      metrics: [
        { label: "Audit logs", value: "DB", tone: "emerald" },
        { label: "Endpoint changes", value: "Tracked", tone: "cyan" },
        { label: "History", value: "Queryable", tone: "blue" },
      ],
      signals: ["Audit rows written on node/model updates", "Case actions are logged", "Stateless runtime safe"],
      actions: ["View logs", "Filter by action", "Export records"],
      notes: ["Useful for ops and compliance review."],
    },
    {
      title: "Circuit Breaker Control",
      subtitle: "Future control plane for chain access throttling.",
      status: "Roadmap",
      objective: "Guard downstream systems when node health degrades.",
      metrics: [
        { label: "Breaker", value: "Planned", tone: "amber" },
        { label: "Thresholds", value: "Planned", tone: "amber" },
        { label: "Recovery", value: "Planned", tone: "amber" },
      ],
      signals: ["Not enforced in runtime yet", "Can be tied to health updates", "Fits Node Endpoint manager"],
      actions: ["Define thresholds", "Bind to health status", "Add alerting"],
      notes: ["Shown here so the role has complete operational scope."],
    },
    {
      title: "Latency and SLA Monitor",
      subtitle: "Track response budgets and ingestion lag.",
      status: "Observed",
      objective: "Spot service regressions early.",
      metrics: [
        { label: "SLA", value: "Visible", tone: "rose" },
        { label: "P95", value: "Future", tone: "rose" },
        { label: "Budget", value: "Future", tone: "rose" },
      ],
      signals: ["Tied to pipeline metrics", "Ready for charting", "Supports alert thresholds"],
      actions: ["Add charts", "Set thresholds", "Monitor deviations"],
      notes: ["A thin visual layer is better than empty space."],
    },
  ],
  ai_data_engineer: [
    {
      title: "Feature Store Selection",
      subtitle: "Define which features are live for inference.",
      status: "Live",
      objective: "Keep inference inputs versioned and explicit.",
      metrics: [
        { label: "Feature configs", value: "Live", tone: "violet" },
        { label: "Enabled", value: "Toggle", tone: "emerald" },
        { label: "Owners", value: "Config", tone: "blue" },
      ],
      signals: ["Feature store API active", "Enabled toggles persisted", "Expression field supported"],
      actions: ["Create feature", "Toggle enabled", "Update expression"],
      notes: ["This is the core input control point for AI scoring."],
    },
    {
      title: "Feature Engineering Recipes",
      subtitle: "Capture transform logic and derived signals.",
      status: "Active",
      objective: "Make derived features readable and repeatable.",
      metrics: [
        { label: "Recipes", value: "Planned", tone: "slate" },
        { label: "Transforms", value: "Planned", tone: "slate" },
        { label: "Windows", value: "Planned", tone: "slate" },
      ],
      signals: ["Current extractor already translates transaction history", "Feature schema aligned to model", "Ready for notebook workflow"],
      actions: ["Define recipe", "Review schema", "Backfill features"],
      notes: ["Use this block to explain feature lineage.", "It should not be empty."],
    },
    {
      title: "Model Registry and Versioning",
      subtitle: "Upload, activate, and roll back model versions.",
      status: "Live",
      objective: "Ensure deterministic deployment selection.",
      metrics: [
        { label: "Model versions", value: "Live", tone: "violet" },
        { label: "Active model", value: "1", tone: "emerald" },
        { label: "Rollback", value: "Ready", tone: "blue" },
      ],
      signals: ["Registry API active", "Activate endpoint wired", "Audit log on promotion"],
      actions: ["Create version", "Activate model", "Review active model"],
      notes: ["This is currently backed by the Phase 2 backend endpoints."],
    },
    {
      title: "Parallel Inference Worker Pools",
      subtitle: "Future concurrency layer for scoring jobs.",
      status: "Roadmap",
      objective: "Scale inference without blocking the API path.",
      metrics: [
        { label: "Workers", value: "Planned", tone: "slate" },
        { label: "Queue", value: "Planned", tone: "slate" },
        { label: "Parallelism", value: "Planned", tone: "slate" },
      ],
      signals: ["Will sit between feature extraction and model selection", "Can be invoked per risk scan", "Useful for large watchlists"],
      actions: ["Plan worker pool", "Define queue semantics", "Add retry policy"],
      notes: ["Shown to complete the role surface area."],
    },
    {
      title: "Backtesting Runner",
      subtitle: "Replay historical flows against candidate models.",
      status: "Planned",
      objective: "Compare models using past labeled outcomes.",
      metrics: [
        { label: "Backtests", value: "Planned", tone: "amber" },
        { label: "Compare", value: "Planned", tone: "amber" },
        { label: "Results", value: "Planned", tone: "amber" },
      ],
      signals: ["Matches roadmap in rearchitecture plan", "Use feedback labels for evaluation", "Can feed compliance reports"],
      actions: ["Run backtest", "Store metrics", "Compare models"],
      notes: ["A required module for a complete AI role workspace."],
    },
    {
      title: "Historical Replay Tools",
      subtitle: "Inspect event windows and feature drift.",
      status: "Planned",
      objective: "Help debug inference on past transactions.",
      metrics: [
        { label: "Replay", value: "Planned", tone: "rose" },
        { label: "Drift", value: "Planned", tone: "rose" },
        { label: "Windows", value: "Planned", tone: "rose" },
      ],
      signals: ["Useful for model QA", "Pairs with audit and cases", "Can be linked to timeline views"],
      actions: ["Open replay", "Inspect drift", "Pin incident"],
      notes: ["This will make the AI role feel complete."],
    },
  ],
  security_analyst: [
    {
      title: "Real-time Alert Board",
      subtitle: "Priority queue of suspicious wallets and events.",
      status: "Live",
      objective: "Show high-risk alerts immediately.",
      metrics: [
        { label: "Alerts", value: "Live", tone: "rose" },
        { label: "Critical", value: "Live", tone: "amber" },
        { label: "Polling", value: "8s", tone: "cyan" },
      ],
      signals: ["Alerts endpoint active", "Auto refresh on", "Severity queue visible"],
      actions: ["Open alert", "Acknowledge", "Inspect wallet"],
      notes: ["This is the primary triage screen for the analyst."],
    },
    {
      title: "Transaction Visualizer",
      subtitle: "Show transfer path and key hops.",
      status: "Planned",
      objective: "Let analyst see movement patterns quickly.",
      metrics: [
        { label: "Hops", value: "Planned", tone: "slate" },
        { label: "Path", value: "Planned", tone: "slate" },
        { label: "Trace", value: "Planned", tone: "slate" },
      ],
      signals: ["Can be derived from transaction history", "Pairs with wallet activity", "Useful for suspicious flow recognition"],
      actions: ["Visualize tx", "Expand path", "Mark suspicious"],
      notes: ["This should be a visual module, not just a text card."],
    },
    {
      title: "Address Label Enrichment",
      subtitle: "Attach labels from blacklists and heuristics.",
      status: "Planned",
      objective: "Give context to unknown wallets.",
      metrics: [
        { label: "Labels", value: "Planned", tone: "violet" },
        { label: "Sources", value: "Planned", tone: "violet" },
        { label: "Confidence", value: "Planned", tone: "violet" },
      ],
      signals: ["Works well with policy rules", "Supports decision quality", "Links to compliance notes"],
      actions: ["Label wallet", "Review source", "Accept enrichment"],
      notes: ["Adds traceability to the analyst workflow."],
    },
    {
      title: "Case Assignment Queue",
      subtitle: "Batch and priority assignment of cases.",
      status: "Live",
      objective: "Move incidents into action.",
      metrics: [
        { label: "Cases", value: "Live", tone: "rose" },
        { label: "Assigned", value: "Live", tone: "emerald" },
        { label: "Escalation", value: "Ready", tone: "cyan" },
      ],
      signals: ["Case APIs active", "Action state machine active", "Audit logs on update"],
      actions: ["Assign", "Confirm fraud", "Dismiss", "Escalate"],
      notes: ["This is the operational center of the analyst role."],
    },
    {
      title: "Confirm and Dismiss Actions",
      subtitle: "Canonical decision outcomes for each case.",
      status: "Live",
      objective: "Close cases with consistent states.",
      metrics: [
        { label: "FRAUD", value: "Live", tone: "rose" },
        { label: "IGNORED", value: "Live", tone: "slate" },
        { label: "VERIFIED", value: "Live", tone: "amber" },
      ],
      signals: ["State transitions validated", "Action payloads audit-logged", "Works off transaction_cases"],
      actions: ["Confirm fraud", "Dismiss", "Escalate"],
      notes: ["Should be rendered as decisive action states."],
    },
    {
      title: "Escalation Workflow",
      subtitle: "Push unresolved incidents upward.",
      status: "Planned",
      objective: "Move high-risk cases to governance review.",
      metrics: [
        { label: "Escalate", value: "Planned", tone: "amber" },
        { label: "Review", value: "Planned", tone: "amber" },
        { label: "SLA", value: "Planned", tone: "amber" },
      ],
      signals: ["Connects to compliance role", "Can trigger notifications", "Useful for incidents with ambiguous risk"],
      actions: ["Escalate case", "Add note", "Notify manager"],
      notes: ["A necessary bridge for system completeness."],
    },
  ],
  compliance_risk_manager: [
    {
      title: "Policy Engine Rules",
      subtitle: "Canonical block/allow rules for transfers.",
      status: "Server-side",
      objective: "Keep policy enforcement visible and consistent.",
      metrics: [
        { label: "Rules", value: "Canonical", tone: "amber" },
        { label: "Blocks", value: "Live", tone: "rose" },
        { label: "Audited", value: "Yes", tone: "emerald" },
      ],
      signals: ["Server policy already blocks risky transfers", "Integrated with wallet risk", "Audit-friendly"],
      actions: ["Review rule", "Adjust threshold", "Simulate decision"],
      notes: ["This is the compliance control plane."],
    },
    {
      title: "Blacklist and Whitelist",
      subtitle: "Manage trusted and blocked entities.",
      status: "Live",
      objective: "Show controls around sanctioned wallets.",
      metrics: [
        { label: "Blacklist", value: "Live", tone: "rose" },
        { label: "Whitelist", value: "Planned", tone: "emerald" },
        { label: "Confidence", value: "Policy", tone: "cyan" },
      ],
      signals: ["Blacklist model exists in DB", "Used by scanner and transfer block", "Supports governance review"],
      actions: ["Add address", "Verify source", "Expire entry"],
      notes: ["Should be joined to a visible table or list."],
    },
    {
      title: "Escalation Governance",
      subtitle: "Review escalated cases and approve actions.",
      status: "Planned",
      objective: "Close the loop between analyst and governance.",
      metrics: [
        { label: "Reviews", value: "Planned", tone: "slate" },
        { label: "Approve", value: "Planned", tone: "slate" },
        { label: "Reject", value: "Planned", tone: "slate" },
      ],
      signals: ["Bridges security analyst and compliance roles", "Useful for exception handling", "Pairs with audit logs"],
      actions: ["Review escalation", "Approve control", "Request follow-up"],
      notes: ["Completes the governance role in the workspace."],
    },
    {
      title: "Regulatory Report Builder",
      subtitle: "Generate evidence and monthly summaries.",
      status: "Planned",
      objective: "Prepare exportable compliance output.",
      metrics: [
        { label: "Reports", value: "Planned", tone: "violet" },
        { label: "Exports", value: "Planned", tone: "violet" },
        { label: "Evidence", value: "Planned", tone: "violet" },
      ],
      signals: ["Mapped to phase 4 in roadmap", "Needs summary aggregates", "Good fit for KPI dashboards"],
      actions: ["Build report", "Export PDF", "Attach evidence"],
      notes: ["Left visible so the role feels complete."],
    },
    {
      title: "Executive KPI Dashboard",
      subtitle: "High-level governance and risk trends.",
      status: "Planned",
      objective: "Let management see risk posture at a glance.",
      metrics: [
        { label: "KPI", value: "Planned", tone: "cyan" },
        { label: "Trend", value: "Planned", tone: "cyan" },
        { label: "SLA", value: "Planned", tone: "cyan" },
      ],
      signals: ["Uses wallet and blocked transfer totals", "Can leverage chart cards", "Should show trend deltas"],
      actions: ["Open KPI", "Compare trend", "Share summary"],
      notes: ["A visible dashboard is better than a blank panel."],
    },
    {
      title: "Control Effectiveness Review",
      subtitle: "Validate whether rules are actually blocking risk.",
      status: "Planned",
      objective: "Measure policy performance over time.",
      metrics: [
        { label: "Effectiveness", value: "Planned", tone: "amber" },
        { label: "False positives", value: "Planned", tone: "amber" },
        { label: "Coverage", value: "Planned", tone: "amber" },
      ],
      signals: ["Compares blocked transfers to alerts", "Needs monthly aggregation", "Useful for governance sign-off"],
      actions: ["Review metrics", "Approve controls", "Adjust policy"],
      notes: ["Completes the compliance workspace hierarchy."],
    },
  ],
};

const TONAL_STYLES: Record<string, string> = {
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-100",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-100",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-100",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
};

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
  const [policyRules, setPolicyRules] = useState<PolicyRuleItem[]>([]);
  const [notificationEvents, setNotificationEvents] = useState<NotificationEventItem[]>([]);
  const [caseSummary, setCaseSummary] = useState<CaseSummary>({
    totals: { PENDING: 0, VERIFIED: 0, FRAUD: 0, IGNORED: 0 },
    unassigned: 0,
    high_risk_unassigned: 0,
  });
  const [reportDays, setReportDays] = useState<number>(30);
  const [complianceReport, setComplianceReport] = useState<ComplianceReportSummary | null>(null);
  const [complianceEffectiveness, setComplianceEffectiveness] = useState<ComplianceEffectiveness | null>(null);
  const [auditCompleteness, setAuditCompleteness] = useState<AuditCompleteness | null>(null);
  const [complianceExport, setComplianceExport] = useState<ComplianceExportPayload | null>(null);
  const [systemSloMetrics, setSystemSloMetrics] = useState<SystemSloMetrics | null>(null);
  const [complianceAuditGaps, setComplianceAuditGaps] = useState<ComplianceAuditGaps | null>(null);

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

  const [caseActionForm, setCaseActionForm] = useState({
    tx_hash: "",
    action: "ESCALATE",
    note: "",
  });

  const [notificationForm, setNotificationForm] = useState({
    channel: "telegram",
    recipient: "security-room",
    severity: "HIGH",
    message: "Case escalated from analyst console",
  });

  const [policyRuleForm, setPolicyRuleForm] = useState({
    rule_name: "block_high_risk_default",
    description: "Block transfer when risk score exceeds threshold",
    min_risk_score: 80,
    priority: 100,
    is_active: true,
  });

  const [policyEvalForm, setPolicyEvalForm] = useState({
    risk_score: 85,
    account_status: "active",
    is_blacklisted: false,
  });

  const [policyEvalResult, setPolicyEvalResult] = useState<{ decision: string; matched_count: number } | null>(null);
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
      pendingCases: 0,
      fraudCases: 0,
      notificationEvents: 0,
    },
    complianceRiskManager: {
      totalWallets: 0,
      criticalAlerts: 0,
      blockedTotal: 0,
      blockedToday: 0,
      blockedValueEth: 0,
      activePolicyRules: 0,
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
  const activeModule = MODULE_BLUEPRINTS[role.key][activeFeatureIndex] ?? MODULE_BLUEPRINTS[role.key][0];

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
        const [nodes, summary, metrics, slo] = await Promise.all([
          fetchJson("/api/ops/system/node-endpoints"),
          fetchJson("/api/ops/system/pipeline-metrics/summary"),
          fetchJson("/api/ops/system/pipeline-metrics?limit=5"),
          fetchJson("/api/ops/system/slo-metrics?days=7"),
        ]);

        setNodeEndpoints((nodes.items ?? []) as NodeEndpoint[]);
        setPipelineMetrics((metrics.items ?? []) as PipelineMetric[]);
        setSystemSloMetrics((slo ?? null) as SystemSloMetrics | null);

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
            `Ingest p95: ${slo.latency_slo?.ingest_p95_ms ?? 0} ms`,
          ],
          p4: [
            `Availability: ${slo.endpoint_health?.availability_pct ?? 0}%`,
            `Error budget burn: ${slo.endpoint_health?.error_budget_burn_pct ?? 0}%`,
            `SLO sample points: ${slo.latency_slo?.sample_points ?? 0}`,
          ],
          note: "Data source: /ops/system/* APIs + /ops/system/slo-metrics",
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
        const [alerts, cases, summary, notifications] = await Promise.all([
          fetchJson("/api/alerts/recent?limit=20"),
          fetchJson("/api/cases?min_risk=0.8&limit=20"),
          fetchJson("/api/ops/security/case-summary"),
          fetchJson("/api/ops/security/notifications?limit=20"),
        ]);

        setAlertItems((alerts.alerts ?? []) as AlertItem[]);
        setCaseItems((cases.cases ?? []) as CaseItem[]);
        setCaseSummary((summary ?? { totals: { PENDING: 0, VERIFIED: 0, FRAUD: 0, IGNORED: 0 }, unassigned: 0, high_risk_unassigned: 0 }) as CaseSummary);
        setNotificationEvents((notifications.items ?? []) as NotificationEventItem[]);

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
            `Pending cases: ${summary.totals?.PENDING ?? 0}`,
          ],
          p4: [
            `Recent notification events: ${notifications.count ?? 0}`,
            "Case timeline API is live: /cases/{tx_hash}/history.",
            "Audit trail is written per analyst action.",
          ],
          note: "Data source: /alerts/recent, /cases, /ops/security/*",
        });
        setDashboardStats((prev) => ({
          ...prev,
          securityAnalyst: {
            alertsToday: Number(alerts.statistics?.total_alerts_today ?? 0),
            criticalAlerts: Number(alerts.statistics?.critical_count ?? 0),
            recentAlerts: Number(alerts.statistics?.total_recent ?? 0),
            openCases: Number(cases.count ?? 0),
            topCaseRisk: cases.cases?.[0]?.risk_score ?? null,
            pendingCases: Number(summary.totals?.PENDING ?? 0),
            fraudCases: Number(summary.totals?.FRAUD ?? 0),
            notificationEvents: Number(notifications.count ?? 0),
          },
        }));
      } else {
        const [dashboard, blocked, rules, report, effectiveness, audit, auditGaps] = await Promise.all([
          fetchJson("/api/statistics/dashboard"),
          fetchJson("/api/blocked-transfers?limit=20"),
          fetchJson("/api/ops/compliance/policy-rules?only_active=true"),
          fetchJson(`/api/ops/compliance/reporting/summary?days=${reportDays}`),
          fetchJson(`/api/ops/compliance/reporting/control-effectiveness?days=${reportDays}`),
          fetchJson(`/api/ops/compliance/reporting/audit-completeness?days=${reportDays}`),
          fetchJson(`/api/ops/compliance/reporting/audit-gaps?days=${reportDays}`),
        ]);

        setBlockedTransfers((blocked.blocked_transfers ?? []) as BlockedTransferItem[]);
        setPolicyRules((rules.items ?? []) as PolicyRuleItem[]);
        setComplianceReport((report ?? null) as ComplianceReportSummary | null);
        setComplianceEffectiveness((effectiveness ?? null) as ComplianceEffectiveness | null);
        setAuditCompleteness((audit ?? null) as AuditCompleteness | null);
        setComplianceAuditGaps((auditGaps ?? null) as ComplianceAuditGaps | null);

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
            `Active policy rules: ${rules.count ?? 0}`,
            "Hard rule execution hooks should run pre-inference.",
            "Compliance actions should link to case outcomes.",
          ],
          p4: [
            `Report window: ${report.period?.days ?? reportDays} days`,
            `Audit completeness: ${audit.completeness_pct ?? 0}%`,
            `Audit gaps: ${auditGaps.missing_count ?? 0}`,
          ],
          note: "Data source: /statistics/dashboard, /blocked-transfers, /ops/compliance/* + /ops/compliance/reporting/*",
        });
        setDashboardStats((prev) => ({
          ...prev,
          complianceRiskManager: {
            totalWallets: Number(dashboard.overview?.total_wallets ?? 0),
            criticalAlerts: Number(dashboard.overview?.critical_alerts ?? 0),
            blockedTotal: Number(blocked.statistics?.total_blocked ?? 0),
            blockedToday: Number(blocked.statistics?.blocked_today ?? 0),
            blockedValueEth: Number(blocked.statistics?.total_value_blocked_eth ?? 0),
            activePolicyRules: Number(rules.count ?? 0),
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

  const submitCaseAction = async () => {
    if (!caseActionForm.tx_hash.trim()) {
      setFactsError("Please enter tx hash for case action");
      return;
    }

    try {
      setIsLoadingFacts(true);
      await fetchJson(`/api/cases/${caseActionForm.tx_hash.trim()}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: caseActionForm.action,
          note: caseActionForm.note || null,
        }),
      });
      setUiMessage("Case action applied");
      await loadRoleFacts("security_analyst");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to apply case action");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const sendTestNotification = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/security/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationForm),
      });
      setUiMessage("Test notification logged");
      await loadRoleFacts("security_analyst");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to send test notification");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const createPolicyRule = async () => {
    try {
      setIsLoadingFacts(true);
      await fetchJson("/api/ops/compliance/policy-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...policyRuleForm,
          block_blacklisted: true,
          block_suspended: true,
          notify_on_block: true,
        }),
      });
      setUiMessage("Policy rule created");
      await loadRoleFacts("compliance_risk_manager");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to create policy rule");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const evaluatePolicyRule = async () => {
    try {
      setIsLoadingFacts(true);
      const result = await fetchJson("/api/ops/compliance/policy-evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyEvalForm),
      });
      setPolicyEvalResult({
        decision: String(result.decision ?? "N/A"),
        matched_count: Number(result.matched_count ?? 0),
      });
      setUiMessage("Policy simulation completed");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to evaluate policy");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const generateComplianceExport = async () => {
    try {
      setIsLoadingFacts(true);
      const payload = (await fetchJson(`/api/ops/compliance/reporting/export?days=${reportDays}`)) as ComplianceExportPayload;
      setComplianceExport(payload);
      setUiMessage(`Compliance export generated: ${payload.filename}`);
      await loadRoleFacts("compliance_risk_manager");
    } catch (error) {
      setFactsError(error instanceof Error ? error.message : "Failed to generate compliance export");
    } finally {
      setIsLoadingFacts(false);
    }
  };

  const downloadComplianceCsv = () => {
    if (!complianceExport?.csv) {
      setFactsError("No export payload available. Generate export first.");
      return;
    }

    const blob = new Blob([complianceExport.csv], { type: "text/csv;charset=utf-8;" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = complianceExport.filename || "compliance_report.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
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

  const renderMetricBar = (label: string, value: number, max: number, tone: string) => {
    const width = max > 0 ? Math.min(100, Math.max(8, (value / max) * 100)) : 8;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{label}</span>
          <span>{value}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800/90">
          <div className={"h-2 rounded-full " + (TONAL_STYLES[tone] ?? TONAL_STYLES.slate)} style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  };

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

            <div className="mb-4 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl space-y-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Module workspace</p>
                  <h3 className="text-xl font-semibold text-white">{activeModule.title}</h3>
                  <p className="text-sm text-slate-300">{activeModule.subtitle}</p>
                  <p className="text-sm text-slate-400">{activeModule.objective}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-300">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <p className="font-medium text-slate-100">{activeModule.status}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {activeModule.metrics.map((metric) => (
                  <div key={metric.label} className={"rounded-xl border px-3 py-2 " + (TONAL_STYLES[metric.tone] ?? TONAL_STYLES.slate)}>
                    <p className="text-xs uppercase tracking-wide opacity-80">{metric.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Signals</p>
                  <div className="space-y-3">
                    {activeModule.signals.map((signal, index) => (
                      <div key={signal} className="flex items-start gap-3">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span>Signal {index + 1}</span>
                            <span>Live</span>
                          </div>
                          <p className="text-sm text-slate-200">{signal}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Actions</p>
                  <div className="space-y-2">
                    {activeModule.actions.map((action) => (
                      <div key={action} className="rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 md:col-span-2">
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Progress view</p>
                  <div className="space-y-3">
                    {renderMetricBar("Coverage", activeModule.metrics.length * 20, 100, activeModule.metrics[0]?.tone ?? "slate")}
                    {renderMetricBar("Module completeness", activeFeatureIndex + 1, 6, activeModule.metrics[1]?.tone ?? "slate")}
                    {renderMetricBar("Visual fill", 4, 4, activeModule.metrics[2]?.tone ?? "slate")}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">Notes</p>
                  <ul className="space-y-2 text-sm text-slate-300">
                    {activeModule.notes.map((note) => (
                      <li key={note} className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">{note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

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
                      <p className="text-xs uppercase tracking-wide text-cyan-200">Availability</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{systemSloMetrics?.endpoint_health.availability_pct ?? 0}%</p>
                      <p className="text-xs text-cyan-100/80">Burn {systemSloMetrics?.endpoint_health.error_budget_burn_pct ?? 0}%</p>
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
                      <p className="text-xs text-rose-100/80">Pending {dashboardStats.securityAnalyst.pendingCases}</p>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                      <p className="text-xs uppercase tracking-wide text-rose-200">Notifications</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.securityAnalyst.notificationEvents}</p>
                      <p className="text-xs text-rose-100/80">Fraud cases {dashboardStats.securityAnalyst.fraudCases}</p>
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
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboardStats.complianceRiskManager.activePolicyRules}</p>
                      <p className="text-xs text-amber-100/80">Active policy rules</p>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:gap-4">
              {activeSection === "overview" ? (
                <>
                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 min-h-[220px]">
                    <h3 className="text-base font-semibold text-slate-100">{role.topLeftTitle}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {roleFacts.p1.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {roleFacts.p1.map((line, index) => (
                        <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-2 text-[11px] text-slate-400">
                          {line}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 min-h-[220px]">
                    <h3 className="text-base font-semibold text-slate-100">{role.topRightTitle}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-300">
                      {roleFacts.p2.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {role.sidebarFeatures.slice(0, 3).map((feature) => (
                        <span key={feature} className="rounded-full border border-slate-600 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-300">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2 min-h-[230px]">
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
                    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
                      {roleFacts.p3.map((line, index) => (
                        <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-xs text-slate-300">
                          {line}
                        </div>
                      ))}
                    </div>
                  </article>

                  <div className="md:col-span-2">
                    <article className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-4 min-h-[180px]">
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
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {roleFacts.p4.map((line, index) => (
                          <div key={`${line}-${index}`} className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-xs text-slate-400">
                            {line}
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </>
              ) : null}

              {activeSection === "actions" ? (
                <>
                  <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 md:col-span-2 min-h-[170px]">
                    <h3 className="text-base font-semibold text-slate-100">Action Center</h3>
                    <p className="mt-1 text-sm text-slate-400">Quick actions for the selected role module.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
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
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Control Summary</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Nodes are listed and can be updated from the same screen.</p>
                          <p>Health changes are persisted and reflected in the dashboard cards.</p>
                          <p>Audit logs exist for operational traceability.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "ai_data_engineer" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Model Lifecycle</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Create a version, mark active, and audit promotion.</p>
                          <p>Active model is surfaced in the dashboard card.</p>
                          <p>Backtesting and replay are planned follow-up modules.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "security_analyst" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Case Action Console</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            value={caseActionForm.tx_hash}
                            onChange={(e) => setCaseActionForm((prev) => ({ ...prev, tx_hash: e.target.value }))}
                            placeholder="Transaction hash"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={caseActionForm.action}
                            onChange={(e) => setCaseActionForm((prev) => ({ ...prev, action: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="ESCALATE">ESCALATE</option>
                            <option value="CONFIRM_FRAUD">CONFIRM_FRAUD</option>
                            <option value="DISMISS">DISMISS</option>
                          </select>
                          <input
                            value={caseActionForm.note}
                            onChange={(e) => setCaseActionForm((prev) => ({ ...prev, note: e.target.value }))}
                            placeholder="Analyst note"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={submitCaseAction}
                            className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-xs text-rose-200"
                          >
                            Apply Case Action
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Notification Test</p>
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={notificationForm.channel}
                            onChange={(e) => setNotificationForm((prev) => ({ ...prev, channel: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="telegram">telegram</option>
                            <option value="slack">slack</option>
                            <option value="email">email</option>
                            <option value="webhook">webhook</option>
                          </select>
                          <input
                            value={notificationForm.recipient}
                            onChange={(e) => setNotificationForm((prev) => ({ ...prev, recipient: e.target.value }))}
                            placeholder="Recipient"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={notificationForm.severity}
                            onChange={(e) => setNotificationForm((prev) => ({ ...prev, severity: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="CRITICAL">CRITICAL</option>
                          </select>
                          <input
                            value={notificationForm.message}
                            onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))}
                            placeholder="Message"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={sendTestNotification}
                            className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-xs text-rose-200"
                          >
                            Send Test Notification
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Case State Snapshot</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Pending: {caseSummary.totals.PENDING}</p>
                          <p>Verified: {caseSummary.totals.VERIFIED}</p>
                          <p>Fraud: {caseSummary.totals.FRAUD}</p>
                          <p>Ignored: {caseSummary.totals.IGNORED}</p>
                          <p>High-risk unassigned: {caseSummary.high_risk_unassigned}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "compliance_risk_manager" ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Policy Rule Builder</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            value={policyRuleForm.rule_name}
                            onChange={(e) => setPolicyRuleForm((prev) => ({ ...prev, rule_name: e.target.value }))}
                            placeholder="Rule name"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <input
                            value={policyRuleForm.description}
                            onChange={(e) => setPolicyRuleForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Description"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={policyRuleForm.min_risk_score}
                              onChange={(e) => setPolicyRuleForm((prev) => ({ ...prev, min_risk_score: Number(e.target.value) || 80 }))}
                              placeholder="Min risk score"
                              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            />
                            <input
                              type="number"
                              value={policyRuleForm.priority}
                              onChange={(e) => setPolicyRuleForm((prev) => ({ ...prev, priority: Number(e.target.value) || 100 }))}
                              placeholder="Priority"
                              className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={createPolicyRule}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200"
                          >
                            Save Policy Rule
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Policy Simulation</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="number"
                            value={policyEvalForm.risk_score}
                            onChange={(e) => setPolicyEvalForm((prev) => ({ ...prev, risk_score: Number(e.target.value) || 0 }))}
                            placeholder="Risk score"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <select
                            value={policyEvalForm.account_status}
                            onChange={(e) => setPolicyEvalForm((prev) => ({ ...prev, account_status: e.target.value }))}
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          >
                            <option value="active">active</option>
                            <option value="under_review">under_review</option>
                            <option value="suspended">suspended</option>
                            <option value="frozen">frozen</option>
                          </select>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={policyEvalForm.is_blacklisted}
                              onChange={(e) => setPolicyEvalForm((prev) => ({ ...prev, is_blacklisted: e.target.checked }))}
                            />
                            Is blacklisted
                          </label>
                          <button
                            type="button"
                            onClick={evaluatePolicyRule}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200"
                          >
                            Evaluate Policy
                          </button>
                          {policyEvalResult ? (
                            <div className="rounded border border-slate-700 bg-slate-950/50 px-2 py-2 text-xs text-slate-300">
                              Decision: {policyEvalResult.decision} | Matched rules: {policyEvalResult.matched_count}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Reporting and Export</p>
                        <div className="grid grid-cols-1 gap-2">
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={reportDays}
                            onChange={(e) => setReportDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
                            placeholder="Report window (days)"
                            className="rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => loadRoleFacts("compliance_risk_manager")}
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200"
                          >
                            Refresh Reporting KPIs
                          </button>
                          <button
                            type="button"
                            onClick={generateComplianceExport}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200"
                          >
                            Generate Compliance Export
                          </button>
                          <button
                            type="button"
                            onClick={downloadComplianceCsv}
                            className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
                          >
                            Download CSV
                          </button>
                          <div className="rounded border border-slate-700 bg-slate-950/50 px-2 py-2 text-xs text-slate-300">
                            Completeness: {auditCompleteness?.completeness_pct ?? 0}% | Gaps: {complianceAuditGaps?.missing_count ?? 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {activeSection === "data" ? (
                <>
                  {role.key === "system_admin" ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
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

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">SLO Hardening</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Window: {systemSloMetrics?.period_days ?? 0} days</p>
                          <p>Healthy active endpoints: {systemSloMetrics?.endpoint_health.healthy_active ?? 0}/{systemSloMetrics?.endpoint_health.active ?? 0}</p>
                          <p>Ingest p95: {systemSloMetrics?.latency_slo.ingest_p95_ms ?? 0} ms</p>
                          <p>Decode p95: {systemSloMetrics?.latency_slo.decode_p95_ms ?? 0} ms</p>
                          <p>Ingest breaches: {systemSloMetrics?.latency_slo.ingest_breaches ?? 0}</p>
                          <p>Decode breaches: {systemSloMetrics?.latency_slo.decode_breaches ?? 0}</p>
                          <p>Latest block: {dashboardStats.systemAdmin.lastBlock ?? "N/A"}</p>
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
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-[11px] text-slate-400">Critical queue</div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-[11px] text-slate-400">Case action</div>
                          <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-[11px] text-slate-400">Timeline ready</div>
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
                        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                          Case states are ready to be acted on from /cases routes.
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Notification Events</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Channel</th>
                                <th className="pb-1">Severity</th>
                                <th className="pb-1">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {notificationEvents.length > 0 ? notificationEvents.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.channel}</td>
                                  <td className="py-1">{row.severity}</td>
                                  <td className="py-1">{row.status}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="py-3 text-slate-500" colSpan={3}>No notification events yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {role.key === "compliance_risk_manager" ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
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
                              {blockedTransfers.length > 0 ? blockedTransfers.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.sender_address.slice(0, 10)}...</td>
                                  <td className="py-1">{row.receiver_address.slice(0, 10)}...</td>
                                  <td className="py-1">{row.amount_eth}</td>
                                  <td className="py-1">{row.risk_score}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="py-3 text-slate-500" colSpan={4}>No blocked transfers yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Policy Rules</p>
                        <div className="max-h-72 overflow-auto text-xs">
                          <table className="w-full text-left">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="pb-1">Rule</th>
                                <th className="pb-1">Min risk</th>
                                <th className="pb-1">Active</th>
                              </tr>
                            </thead>
                            <tbody>
                              {policyRules.length > 0 ? policyRules.map((row) => (
                                <tr key={row.id} className="border-t border-slate-700/60 text-slate-200">
                                  <td className="py-1">{row.rule_name}</td>
                                  <td className="py-1">{row.min_risk_score}</td>
                                  <td className="py-1">{row.is_active ? "Yes" : "No"}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td className="py-3 text-slate-500" colSpan={3}>No policy rules yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Control Effectiveness</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Actionable alerts: {complianceEffectiveness?.inputs.actionable_alerts ?? 0}</p>
                          <p>Blocked total: {complianceEffectiveness?.inputs.blocked_total ?? 0}</p>
                          <p>Block rate: {complianceEffectiveness?.metrics.block_rate_pct ?? 0}%</p>
                          <p>Fraud precision proxy: {complianceEffectiveness?.metrics.fraud_precision_proxy_pct ?? 0}%</p>
                          <p>Decision coverage: {complianceEffectiveness?.metrics.decision_coverage ?? 0}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Audit Completeness</p>
                        <div className="space-y-2 text-sm text-slate-300">
                          <p>Required actions: {auditCompleteness?.required_actions ?? 0}</p>
                          <p>Present actions: {auditCompleteness?.present_actions ?? 0}</p>
                          <p>Completeness: {auditCompleteness?.completeness_pct ?? 0}%</p>
                          <p>Audit events: {complianceReport?.kpis.audit_events ?? 0}</p>
                        </div>
                        <div className="mt-2 max-h-28 overflow-auto rounded border border-slate-700 bg-slate-950/50 px-2 py-2 text-[11px] text-slate-400">
                          {(auditCompleteness?.checks ?? []).map((item) => (
                            <div key={item.action_type} className="flex items-center justify-between border-b border-slate-800 py-1 last:border-b-0">
                              <span>{item.action_type}</span>
                              <span>{item.count}</span>
                            </div>
                          ))}
                        </div>
                        {(complianceAuditGaps?.missing_actions?.length ?? 0) > 0 ? (
                          <div className="mt-2 max-h-28 overflow-auto rounded border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-100">
                            {complianceAuditGaps?.missing_actions.map((item) => (
                              <div key={item.action_type} className="border-b border-amber-500/20 py-1 last:border-b-0">
                                <p className="font-semibold">{item.action_type} ({item.owner_role})</p>
                                <p>{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="md:col-span-2 rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-400 min-h-[120px]">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <span>Data note: {roleFacts.note}</span>
                      <span>{isLoadingFacts ? "loading..." : "ready"}{factsError ? ` | error: ${factsError}` : ""}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">Linked to active role module</div>
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">Data shown only for active section</div>
                      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">Workspace remains inherited across roles</div>
                    </div>
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

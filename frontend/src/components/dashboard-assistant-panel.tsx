"use client";

import { useEffect, useState } from "react";
import { RotateCcw, SendHorizonal } from "lucide-react";
import { askDashboardAssistant, type AssistantChatResponse } from "@/lib/api";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  knowledgeSources?: Array<{ source: string; heading: string; score: number }>;
};

type AssistantScope = "dashboard" | "wallet" | "case" | "policy" | "tracking";

type AssistantContext = {
  overview?: {
    total_wallets: number;
    total_alerts: number;
    critical_alerts: number;
    alerts_today: number;
    total_blocked: number;
  };
  top_risky_wallets?: Array<{
    address: string;
    label: string | null;
    risk_score: number;
    account_status: string;
  }>;
  wallet_focus?: {
    address: string;
    exists: boolean;
    risk_score: number;
    account_status: string | null;
    label: string | null;
    transaction_count: number;
    alert_count: number;
  } | null;
  screen_scope?: string;
  dashboard_role?: string;
  dashboard_feature_index?: number;
  dashboard_feature_label?: string;
};

function dedupeStrings(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const key = value.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(key);
  });
  return output;
}

function dedupeKnowledgeSources(
  values: Array<{ source: string; heading: string; score: number }> | undefined
): Array<{ source: string; heading: string; score: number }> {
  if (!values?.length) return [];
  const seen = new Set<string>();
  const output: Array<{ source: string; heading: string; score: number }> = [];
  values.forEach((item) => {
    const key = `${item.source.trim()}::${item.heading.trim()}`;
    if (!item.source?.trim() || seen.has(key)) return;
    seen.add(key);
    output.push(item);
  });
  return output;
}

function normalizeAssistantText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type DashboardAssistantPanelProps = {
  roleKey: string;
  roleLabel: string;
  currentScope: string;
  walletAddress?: string | null;
  context: AssistantContext;
  onScopeChange: (scope: AssistantScope) => void;
};

const SCOPE_LABELS: Record<AssistantScope, string> = {
  dashboard: "Dashboard",
  wallet: "Wallet",
  case: "Case",
  policy: "Policy",
  tracking: "Tracking",
};

export default function DashboardAssistantPanel({
  roleKey,
  roleLabel,
  currentScope,
  walletAddress,
  context,
  onScopeChange,
}: DashboardAssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content:
        "Mình có thể hỗ trợ cả câu hỏi về hệ thống lẫn câu hỏi chung. Bạn cứ hỏi tự nhiên, mình sẽ trả lời theo ngữ cảnh phù hợp.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [walletInputValue, setWalletInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const panelStorageKey = `assistant:history:${roleKey}:${currentScope}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(panelStorageKey);
    if (!raw) {
      setMessages([
        {
          role: "assistant",
          content:
            "Mình có thể hỗ trợ cả câu hỏi về hệ thống lẫn câu hỏi chung. Bạn cứ hỏi tự nhiên, mình sẽ trả lời theo ngữ cảnh phù hợp.",
        },
      ]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AssistantMessage[];
      if (Array.isArray(parsed) && parsed.length) {
        setMessages(parsed);
      }
    } catch {
      setMessages([
        {
          role: "assistant",
          content:
            "Mình có thể hỗ trợ cả câu hỏi về hệ thống lẫn câu hỏi chung. Bạn cứ hỏi tự nhiên, mình sẽ trả lời theo ngữ cảnh phù hợp.",
        },
      ]);
    }
  }, [panelStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(panelStorageKey, JSON.stringify(messages.slice(-20)));
  }, [messages, panelStorageKey]);

  async function sendQuestion(question?: string) {
    const normalizedQuestion = (question ?? inputValue).trim();
    if (!normalizedQuestion || isLoading) {
      return;
    }

    setIsLoading(true);
    const conversationHistory = [...messages, { role: "user" as const, content: normalizedQuestion }]
      .slice(-6)
      .map((entry) => ({ role: entry.role, content: entry.content }));

    setMessages((previous) => [...previous, { role: "user", content: normalizedQuestion }]);
    setInputValue("");

    try {
      const response: AssistantChatResponse = await askDashboardAssistant(
        normalizedQuestion,
        roleKey,
        walletInputValue.trim() || walletAddress || undefined,
        conversationHistory,
        currentScope,
        context
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: normalizeAssistantText(response.answer),
          sources: dedupeStrings(response.sources),
          knowledgeSources: dedupeKnowledgeSources(response.knowledge_sources),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant unavailable";
      setMessages((previous) => [...previous, { role: "assistant", content: `Hiện chưa thể trả lời do lỗi kết nối trợ lý: ${message}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    const resetMessages: AssistantMessage[] = [
      {
        role: "assistant",
        content:
          "Mình có thể hỗ trợ cả câu hỏi về hệ thống lẫn câu hỏi chung. Bạn cứ hỏi tự nhiên, mình sẽ trả lời theo ngữ cảnh phù hợp.",
      },
    ];
    setMessages(resetMessages);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(panelStorageKey);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl shadow-black/30">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Assistant</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">Global Operator Assistant</h3>
          <p className="mt-1 text-sm text-slate-400">
            Role: {roleLabel} · Scope: {SCOPE_LABELS[currentScope as AssistantScope] || currentScope}
          </p>
        </div>
        <button
          type="button"
          onClick={clearChat}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
          Clear chat
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr] md:items-center">
        <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Scope</label>
        <select
          value={currentScope}
          onChange={(event) => onScopeChange(event.target.value as AssistantScope)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500"
        >
          <option value="dashboard">Dashboard</option>
          <option value="wallet">Wallet</option>
          <option value="case">Case</option>
          <option value="policy">Policy</option>
          <option value="tracking">Tracking</option>
        </select>
      </div>

      {context.overview || context.dashboard_role ? (
        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2 text-slate-400">
            <span className="uppercase tracking-[0.24em]">Loaded context</span>
            {context.dashboard_role ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px]">Role: {context.dashboard_role}</span> : null}
            {typeof context.dashboard_feature_index === "number" ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px]">Feature: {context.dashboard_feature_index}</span> : null}
            {context.dashboard_feature_label ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px]">{context.dashboard_feature_label}</span> : null}
          </div>
          {context.overview ? (
            <div className="mt-2 grid gap-2 md:grid-cols-5">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">Wallets: {context.overview.total_wallets}</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">Alerts: {context.overview.total_alerts}</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">Critical: {context.overview.critical_alerts}</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">Today: {context.overview.alerts_today}</div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">Blocked: {context.overview.total_blocked}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={[
              "rounded-xl px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap",
              message.role === "assistant"
                ? "border border-slate-700 bg-slate-800/80 text-slate-50"
                : "border border-slate-800 bg-slate-900/60 text-slate-300",
            ].join(" ")}
          >
            {message.content}
            {message.role === "assistant" && message.sources && message.sources.length ? (
              <p className="mt-2 border-t border-white/20 pt-2 text-[11px] text-white/80">
                Sources: {message.sources.join(" | ")}
              </p>
            ) : null}
            {message.role === "assistant" && message.knowledgeSources && message.knowledgeSources.length ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Docs: {dedupeStrings(message.knowledgeSources.map((item) => item.source)).join(" | ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <input
          type="text"
          value={walletInputValue}
          onChange={(event) => setWalletInputValue(event.target.value)}
          placeholder="(Optional) Wallet focus, e.g. 0xabc..."
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-slate-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask anything about the system or a general topic..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendQuestion();
              }
            }}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none transition focus:border-slate-500"
          />
          <button
            type="button"
            onClick={() => void sendQuestion()}
            disabled={isLoading || !inputValue.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizonal className="h-5 w-5" />
            {isLoading ? "Đang trả lời..." : "Gửi"}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Knowledge sources</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded-full border border-slate-700 px-2 py-1">README.md</span>
          <span className="rounded-full border border-slate-700 px-2 py-1">DEPLOY_HF_SUPABASE.md</span>
          <span className="rounded-full border border-slate-700 px-2 py-1">role-based-rearchitecture-plan.md</span>
        </div>
      </div>
    </section>
  );
}

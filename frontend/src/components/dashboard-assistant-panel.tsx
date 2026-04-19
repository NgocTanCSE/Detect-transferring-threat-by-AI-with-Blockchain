"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, SendHorizonal, Sparkles } from "lucide-react";
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
};

type DashboardAssistantPanelProps = {
  roleKey: string;
  roleLabel: string;
  currentScope: string;
  walletAddress?: string | null;
  context: AssistantContext;
  onScopeChange: (scope: AssistantScope) => void;
};

const QUICK_PROMPTS: Record<AssistantScope, string[]> = {
  dashboard: [
    "Giải thích 4 chỉ số chính trên dashboard",
    "Alerts hôm nay tăng hay giảm so với ngữ cảnh hiện tại?",
    "Nên ưu tiên hành động nào trong 15 phút tới?",
  ],
  wallet: [
    "Ví này có nguy cơ bị freeze không?",
    "Risk score của ví này đọc thế nào?",
    "Nên làm gì với ví có status under_review?",
  ],
  case: [
    "Case nào nên escalate trước?",
    "Sự khác nhau giữa PENDING và FRAUD là gì?",
    "Khi nào nên dismiss một case?",
  ],
  policy: [
    "Policy rule nào đang ảnh hưởng mạnh nhất?",
    "Audit completeness có đạt không?",
    "Nên bổ sung control nào để giảm gaps?",
  ],
  tracking: [
    "Giải thích mạng kết nối của wallet đang chọn",
    "Wallet focus này đang có bao nhiêu giao dịch và alerts?",
    "Đề xuất hành động với wallet này",
  ],
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
        "Mình là trợ lý vận hành. Bạn có thể hỏi về chỉ số, case, policy, hoặc dùng Quick prompts bên dưới.",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [walletInputValue, setWalletInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const panelStorageKey = useMemo(() => `assistant:history:${roleKey}:${currentScope}`, [currentScope, roleKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(panelStorageKey);
    if (!raw) {
      setMessages([
        {
          role: "assistant",
          content:
            "Mình là trợ lý vận hành. Bạn có thể hỏi về chỉ số, case, policy, hoặc dùng Quick prompts bên dưới.",
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
            "Mình là trợ lý vận hành. Bạn có thể hỏi về chỉ số, case, policy, hoặc dùng Quick prompts bên dưới.",
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
        conversationHistory
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: response.answer,
          sources: response.sources,
          knowledgeSources: response.knowledge_sources,
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
          "Mình là trợ lý vận hành. Bạn có thể hỏi về chỉ số, case, policy, hoặc dùng Quick prompts bên dưới.",
      },
    ];
    setMessages(resetMessages);
    setInputValue("");
    setWalletInputValue("");
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(panelStorageKey, JSON.stringify(resetMessages));
    }
  }

  return (
    <section className="mb-4 rounded-[26px] border border-cyan-500/20 bg-slate-950/80 p-4 shadow-[0_20px_60px_rgba(8,47,73,0.35)] backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">Assistant</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Operational Chat Panel</h2>
          <p className="mt-1 text-sm text-slate-400">Role: {roleLabel} · Scope: {SCOPE_LABELS[currentScope as AssistantScope] || currentScope}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-cyan-500/40 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 3
          </span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr] md:items-center">
        <label className="text-xs uppercase tracking-[0.24em] text-slate-500">Scope</label>
        <select
          value={currentScope}
          onChange={(event) => onScopeChange(event.target.value as AssistantScope)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
        >
          <option value="dashboard">Dashboard</option>
          <option value="wallet">Wallet</option>
          <option value="case">Case</option>
          <option value="policy">Policy</option>
          <option value="tracking">Tracking</option>
        </select>
      </div>

      <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <p className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">Quick prompts</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS[currentScope as AssistantScope].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendQuestion(prompt)}
              className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-500/40 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={[
              "rounded-xl px-3 py-3 text-sm leading-relaxed",
              message.role === "assistant"
                ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-50"
                : "border border-slate-700 bg-slate-800 text-slate-200",
            ].join(" ")}
          >
            {message.content}
            {message.role === "assistant" && message.sources && message.sources.length ? (
              <p className="mt-2 border-t border-cyan-400/20 pt-2 text-[11px] text-cyan-200/80">
                Sources: {message.sources.join(" | ")}
              </p>
            ) : null}
            {message.role === "assistant" && message.knowledgeSources && message.knowledgeSources.length ? (
              <p className="mt-2 text-[11px] text-slate-400">
                Docs: {message.knowledgeSources.map((item) => item.source).join(" | ")}
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
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask about a metric, case, policy, or wallet..."
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void sendQuestion();
              }
            }}
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={() => void sendQuestion()}
            disabled={isLoading || !inputValue.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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

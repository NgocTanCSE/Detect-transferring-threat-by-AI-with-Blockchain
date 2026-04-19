"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchDashboardStats } from "@/lib/api";
import DashboardAssistantPanel from "@/components/dashboard-assistant-panel";

type AssistantScope = "dashboard" | "wallet" | "case" | "policy" | "tracking";

function resolveScope(pathname: string): AssistantScope {
  if (pathname.startsWith("/admin/tracking")) return "tracking";
  if (pathname.startsWith("/admin/history")) return "case";
  if (pathname.startsWith("/admin/dashboard")) return "dashboard";
  if (pathname.startsWith("/user/exchange") || pathname.startsWith("/user/history")) return "wallet";
  return "dashboard";
}

function resolveRoleKey(role?: string | null): "system_admin" | "ai_data_engineer" | "security_analyst" | "compliance_risk_manager" {
  if (role === "admin") return "system_admin";
  if (role === "analyst") return "security_analyst";
  return "compliance_risk_manager";
}

export default function GlobalAssistantWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const scope = useMemo(() => resolveScope(pathname), [pathname]);
  const [currentScope, setCurrentScope] = useState<AssistantScope>(scope);
  const roleKey = resolveRoleKey(user?.role);
  const roleLabel = user?.username ?? "Operator";

  useEffect(() => {
    setCurrentScope(scope);
  }, [scope]);

  const { data: dashboardStats } = useQuery({
    queryKey: ["assistant-dashboard-stats"],
    queryFn: fetchDashboardStats,
    enabled: open,
    staleTime: 30_000,
  });

  const assistantContext = useMemo(
    () => ({
      overview: dashboardStats?.overview,
      top_risky_wallets: [],
      wallet_focus: user?.wallet_address
        ? {
          address: user.wallet_address,
          exists: true,
          risk_score: 0,
          account_status: null,
          label: user.username,
          transaction_count: 0,
          alert_count: 0,
        }
        : null,
      screen_scope: scope,
    }),
    [dashboardStats?.overview, scope, user?.username, user?.wallet_address]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/20 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.15),0_18px_40px_rgba(8,145,178,0.35)] transition hover:scale-105 hover:bg-cyan-500/30"
        aria-label="Open assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-slate-700 bg-slate-950 text-slate-100 shadow-[0_30px_100px_rgba(2,6,23,0.6)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300">Assistant</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Global Operator Assistant</h2>
              <p className="mt-1 text-sm text-slate-400">Available across the whole app · {roleLabel} · {pathname}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <DashboardAssistantPanel
            roleKey={roleKey}
            roleLabel={roleLabel}
            currentScope={currentScope}
            walletAddress={user?.wallet_address ?? null}
            context={assistantContext}
            onScopeChange={setCurrentScope}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

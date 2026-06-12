"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Activity,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchDashboardStats,
  fetchRecentAlerts,
  fetchWalletBalance,
  type DashboardStats,
  type Alert,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAddress, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function UserDashboard() {
  const { user } = useAuth();
  const walletAddress = user?.wallet_address || "";

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: () => fetchDashboardStats(),
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<{
    alerts: Alert[];
  }>({
    queryKey: ["recentAlerts"],
    queryFn: () => fetchRecentAlerts(10),
  });

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["walletBalance", walletAddress],
    queryFn: () => fetchWalletBalance(walletAddress),
    enabled: !!walletAddress,
  });

  const overview = stats?.overview;
  const statCards = [
    {
      label: "Tổng Ví",
      value: overview?.total_wallets || 0,
      icon: Wallet,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
    {
      label: "Cảnh Báo",
      value: overview?.total_alerts || 0,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Nghiêm Trọng",
      value: overview?.critical_alerts || 0,
      icon: Ban,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Hôm Nay",
      value: overview?.alerts_today || 0,
      icon: Clock,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
  ];

  const alerts = alertsData?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Xin chào, {user?.username || "User"}
          </h1>
          <p className="text-slate-400 mt-1">
            Tổng quan hệ thống giám sát blockchain
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
            <Shield className="h-5 w-5 text-teal-400" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-[#0f0f16] border-slate-800/50 hover:border-slate-700/50 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {statsLoading ? (
                      <span className="inline-block w-16 h-7 bg-slate-800 rounded animate-pulse" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Wallet Balance Card */}
      {walletAddress && (
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-teal-400" />
              Số Dư Ví
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-white">
                  {balanceLoading ? (
                    <span className="inline-block w-32 h-9 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    `${balance?.balance_eth?.toFixed(4) || "0.0000"} ETH`
                  )}
                </p>
                <p className="text-sm text-slate-500 mt-1 font-mono">{formatAddress(walletAddress)}</p>
              </div>
              <Link href="/user/wallet">
                <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 transition-colors cursor-pointer">
                  <Activity className="h-6 w-6 text-teal-400" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Threat Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Rửa Tiền",
            count: stats?.money_laundering?.wallet_count || 0,
            alerts: stats?.money_laundering?.alert_count || 0,
            color: "from-blue-500/20 to-blue-600/5",
            border: "border-blue-500/20",
            icon: "🔒",
          },
          {
            label: "Thao Túng",
            count: stats?.manipulation?.wallet_count || 0,
            alerts: stats?.manipulation?.alert_count || 0,
            color: "from-amber-500/20 to-amber-600/5",
            border: "border-amber-500/20",
            icon: "⚠️",
          },
          {
            label: "Lừa Đảo",
            count: stats?.scam?.wallet_count || 0,
            alerts: stats?.scam?.alert_count || 0,
            color: "from-red-500/20 to-red-600/5",
            border: "border-red-500/20",
            icon: "🚨",
          },
        ].map((cat, i) => (
          <Card key={i} className={`bg-gradient-to-br ${cat.color} ${cat.border} border`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{cat.icon}</span>
                <span className="font-semibold text-white">{cat.label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Ví: <span className="text-white font-bold">{cat.count}</span></span>
                <span className="text-slate-400">Alerts: <span className="text-white font-bold">{cat.alerts}</span></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Alerts */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Cảnh Báo Gần Đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Không có cảnh báo nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.alert_id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/30 hover:border-slate-700/50 transition-colors"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      alert.severity === "CRITICAL"
                        ? "bg-red-500/10"
                        : alert.severity === "HIGH"
                        ? "bg-amber-500/10"
                        : "bg-slate-500/10"
                    }`}
                  >
                    {alert.severity === "CRITICAL" ? (
                      <Ban className="h-4 w-4 text-red-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{alert.message}</p>
                    <p className="text-xs text-slate-500">
                      {formatAddress(alert.wallet_address)} • {formatDate(alert.detected_at)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      alert.severity === "CRITICAL"
                        ? "bg-red-500/20 text-red-400"
                        : alert.severity === "HIGH"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-500/20 text-slate-400"
                    }`}
                  >
                    {alert.risk_score}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

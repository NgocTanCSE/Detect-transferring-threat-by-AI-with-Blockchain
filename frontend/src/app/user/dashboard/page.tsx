"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Activity,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchUserHistory,
  fetchWalletBalance,
  type UserHistory,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAddress, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function UserDashboard() {
  const { user } = useAuth();
  const walletAddress = user?.wallet_address || "";

  const { data: history, isLoading: historyLoading } = useQuery<UserHistory>({
    queryKey: ["userHistory", walletAddress],
    queryFn: () => fetchUserHistory(walletAddress),
    enabled: !!walletAddress,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ["walletBalance", walletAddress],
    queryFn: () => fetchWalletBalance(walletAddress),
    enabled: !!walletAddress,
  });

  const summary = history?.summary;
  const statCards = [
    {
      label: "Tổng Giao Dịch",
      value: summary?.total_transactions ?? 0,
      icon: Activity,
      color: "text-teal-400",
      bg: "bg-teal-500/10",
    },
    {
      label: "Bị Chặn",
      value: summary?.total_blocked ?? 0,
      icon: Ban,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Cảnh Báo",
      value: summary?.total_warnings ?? 0,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Số Cảnh Báo",
      value: summary?.warning_count ?? 0,
      icon: AlertTriangle,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  ];

  const blockedTransfers = history?.blocked_transfers || [];
  const successfulTxs = history?.successful_transactions || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Xin chào, {user?.username || "User"}
          </h1>
          <p className="text-slate-400 mt-1">
            Lịch sử giao dịch và cảnh báo cá nhân
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
                    {historyLoading ? (
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

      {/* Recent Blocked Transfers */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-400" />
            Giao Dịch Bị Chặn
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : blockedTransfers.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Không có giao dịch bị chặn</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blockedTransfers.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/30"
                >
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <Ban className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">Chặn chuyển tới {formatAddress(tx.receiver_address)}</p>
                    <p className="text-xs text-slate-500">
                      {formatAddress(tx.sender_address)} • {tx.risk_score.toFixed(1)}%
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                    {(tx.amount_eth ?? 0).toFixed(4)} ETH
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Warnings */}
      {history?.warnings && history.warnings.length > 0 && (
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Cảnh Báo Của Bạn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.warnings.slice(0, 5).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/30"
                >
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{w.warning_type}</p>
                    <p className="text-xs text-slate-500">
                      Đối tượng: {formatAddress(w.target_address)}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">
                    {w.risk_score.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-teal-400" />
            Giao Dịch Gần Đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : successfulTxs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {successfulTxs.slice(0, 5).map((tx) => (
                <div
                  key={tx.tx_hash || tx.id}
                  className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/30 hover:border-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {tx.from_address === walletAddress ? (
                      <ArrowUpRight className="text-red-400 h-5 w-5" />
                    ) : (
                      <ArrowDownLeft className="text-teal-400 h-5 w-5" />
                    )}
                    <div>
                      <p className="text-xs font-mono text-slate-300">
                        {tx.from_address === walletAddress ? "Đến" : "Từ"}: {formatAddress(tx.from_address === walletAddress ? tx.to_address : tx.from_address)}
                      </p>
                      <p className="text-[10px] text-slate-500">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${tx.from_address === walletAddress ? "text-red-400" : "text-teal-400"}`}>
                    {tx.from_address === walletAddress ? "-" : "+"}{(tx.value_eth ?? 0).toFixed(4)} ETH
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
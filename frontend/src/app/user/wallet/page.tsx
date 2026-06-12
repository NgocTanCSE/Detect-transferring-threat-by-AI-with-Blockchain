"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  RefreshCw,
  Clock,
  Shield,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchWalletBalance,
  fetchWalletStats,
  fetchWalletTransactions,
  type WalletBalance,
  type WalletStats,
  type Transaction,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAddress, formatEth, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function UserWallet() {
  const { user } = useAuth();
  const walletAddress = user?.wallet_address || "";

  const { data: balance, isLoading: balanceLoading } = useQuery<WalletBalance>({
    queryKey: ["walletBalance", walletAddress],
    queryFn: () => fetchWalletBalance(walletAddress),
    enabled: !!walletAddress,
  });

  const { data: walletStats, isLoading: statsLoading } = useQuery<WalletStats>({
    queryKey: ["walletStats", walletAddress],
    queryFn: () => fetchWalletStats(walletAddress),
    enabled: !!walletAddress,
  });

  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["walletTransactions", walletAddress],
    queryFn: () => fetchWalletTransactions(walletAddress, 5),
    enabled: !!walletAddress,
  });

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ví Của Tôi</h1>
          <p className="text-slate-400 mt-1">Quản lý ví và xem số dư</p>
        </div>
        <Link href="/user/exchange">
          <Button className="bg-teal-500 hover:bg-teal-400 text-slate-950">
            <Send className="h-4 w-4 mr-2" />
            Chuyển Tiền
          </Button>
        </Link>
      </div>

      {/* Wallet Address Card */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">Địa Chỉ Ví</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg font-mono text-white">{formatAddress(walletAddress)}</p>
                <button onClick={copyAddress} className="text-slate-500 hover:text-teal-400 transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <a
              href={`https://etherscan.io/address/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-teal-400 transition-colors"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Balance & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">Số Dư Hiện Tại</p>
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-4xl font-bold text-white">
              {balanceLoading ? (
                <span className="inline-block w-40 h-10 bg-slate-800 rounded animate-pulse" />
              ) : (
                `${balance?.balance_eth?.toFixed(4) || "0.0000"}`
              )}
            </p>
            <p className="text-sm text-slate-500 mt-1">ETH</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardContent className="p-6">
            <p className="text-sm text-slate-400 mb-4">Thống Kê Giao Dịch</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Đã Gửi</p>
                <p className="text-lg font-bold text-white">
                  {statsLoading ? (
                    <span className="inline-block w-12 h-5 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    `${walletStats?.eth_sent?.toFixed(2) || "0"} ETH`
                  )}
                </p>
                <p className="text-[10px] text-slate-600">{walletStats?.sent_count || 0} giao dịch</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Đã Nhận</p>
                <p className="text-lg font-bold text-teal-400">
                  {statsLoading ? (
                    <span className="inline-block w-12 h-5 bg-slate-800 rounded animate-pulse" />
                  ) : (
                    `${walletStats?.eth_received?.toFixed(2) || "0"} ETH`
                  )}
                </p>
                <p className="text-[10px] text-slate-600">{walletStats?.received_count || 0} giao dịch</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Status */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${
                (balance?.risk_score || 0) > 50
                  ? "bg-red-500/10"
                  : "bg-teal-500/10"
              }`}
            >
              {(balance?.risk_score || 0) > 50 ? (
                <AlertTriangle className="h-6 w-6 text-red-400" />
              ) : (
                <Shield className="h-6 w-6 text-teal-400" />
              )}
            </div>
            <div>
              <p className="text-sm text-slate-400">Đánh Giá Rủi Ro</p>
              <p className="text-xl font-bold text-white">
                {balance?.risk_score || 0}%
                <span
                  className={`text-sm font-normal ml-2 ${
                    (balance?.risk_score || 0) > 50
                      ? "text-red-400"
                      : "text-teal-400"
                  }`}
                >
                  {(balance?.risk_score || 0) > 80
                    ? "CAO"
                    : (balance?.risk_score || 0) > 50
                    ? "TRUNG BÌNH"
                    : "THẤP"}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            Giao Dịch Gần Đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Chưa có giao dịch nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.tx_hash}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800/20 transition-colors"
                >
                  {tx.from_address.toLowerCase() === walletAddress.toLowerCase() ? (
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ArrowDownLeft className="h-4 w-4 text-teal-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-slate-300 truncate">
                      {formatAddress(
                        tx.from_address.toLowerCase() === walletAddress.toLowerCase()
                          ? tx.to_address
                          : tx.from_address
                      )}
                    </p>
                    <p className="text-[10px] text-slate-600">{formatDate(tx.timestamp)}</p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      tx.from_address.toLowerCase() === walletAddress.toLowerCase()
                        ? "text-slate-300"
                        : "text-teal-400"
                    }`}
                  >
                    {tx.from_address.toLowerCase() === walletAddress.toLowerCase()
                      ? "-"
                      : "+"}
                    {formatEth(Number(tx.value_wei) / 1e18 || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link href="/user/transactions">
            <Button variant="ghost" className="w-full mt-4 text-slate-400 hover:text-white">
              Xem tất cả →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

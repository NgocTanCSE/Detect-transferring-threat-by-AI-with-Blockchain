"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Download,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchWalletTransactionHistory,
  type WalletTransaction,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatAddress, formatDate, formatEth } from "@/lib/utils";

export default function UserTransactions() {
  const { user } = useAuth();
  const walletAddress = user?.wallet_address || "";
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "sent" | "received">("all");

  const { data: transactions, isLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["walletTransactions", walletAddress],
    queryFn: () => fetchWalletTransactionHistory(walletAddress, 100),
    enabled: !!walletAddress,
  });

  const filteredTxs = (transactions || []).filter((tx) => {
    const matchesSearch =
      !searchTerm ||
      tx.counterparty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.tx_hash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "all" || tx.direction === filterType;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: transactions?.length || 0,
    sent: transactions?.filter((tx) => tx.direction === "sent").length || 0,
    received: transactions?.filter((tx) => tx.direction === "received").length || 0,
    flagged: transactions?.filter((tx) => tx.is_flagged).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lịch Sử Giao Dịch</h1>
          <p className="text-slate-400 mt-1">Xem tất cả giao dịch đã thực hiện</p>
        </div>
        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <Download className="h-4 w-4 mr-2" />
          Xuất CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng", value: stats.total, color: "text-white" },
          { label: "Đã Gửi", value: stats.sent, color: "text-slate-400" },
          { label: "Đã Nhận", value: stats.received, color: "text-teal-400" },
          { label: "Đánh Dấu", value: stats.flagged, color: "text-amber-400" },
        ].map((stat, i) => (
          <Card key={i} className="bg-[#0f0f16] border-slate-800/50">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                {isLoading ? (
                  <span className="inline-block w-10 h-6 bg-slate-800 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Tìm theo địa chỉ hoặc hash..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#0f0f16] border-slate-800 text-white"
          />
        </div>
        <div className="flex gap-1 bg-[#0f0f16] border border-slate-800 rounded-lg p-1">
          {(["all", "sent", "received"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterType === type
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {type === "all" ? "Tất cả" : type === "sent" ? "Gửi" : "Nhận"}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredTxs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Không có giao dịch nào</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredTxs.map((tx) => (
                <div
                  key={tx.tx_hash}
                  className="flex items-center gap-4 p-4 hover:bg-slate-800/20 transition-colors"
                >
                  {/* Direction Icon */}
                  <div
                    className={`p-2.5 rounded-xl ${
                      tx.direction === "sent"
                        ? "bg-slate-500/10"
                        : "bg-teal-500/10"
                    }`}
                  >
                    {tx.direction === "sent" ? (
                      <ArrowUpRight className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ArrowDownLeft className="h-5 w-5 text-teal-400" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {tx.direction === "sent" ? "Gửi đến" : "Nhận từ"}
                      </p>
                      {tx.is_flagged && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">
                          FLAGGED
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      {tx.counterparty_label || formatAddress(tx.counterparty)}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {tx.timestamp ? formatDate(tx.timestamp) : "N/A"} • Block #{tx.block_number}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${
                        tx.direction === "sent" ? "text-slate-300" : "text-teal-400"
                      }`}
                    >
                      {tx.direction === "sent" ? "-" : "+"}
                      {tx.value_eth?.toFixed(4) || "0.0000"} ETH
                    </p>
                    {tx.counterparty_risk > 0 && (
                      <p className="text-[10px] text-slate-500">
                        Risk: {tx.counterparty_risk}%
                      </p>
                    )}
                  </div>

                  {/* External Link */}
                  <a
                    href={`https://etherscan.io/tx/${tx.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:text-teal-400 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

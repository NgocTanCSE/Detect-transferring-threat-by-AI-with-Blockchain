"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Radar,
  Eye,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Link2,
  X,
  Wallet as WalletIcon,
  Activity,
  ExternalLink,
  Clock,
  History,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  fetchWallets,
  fetchWalletConnections,
  fetchWalletStats,
  fetchWalletTransactionHistory,
  type Wallet,
  type WalletConnectionsResponse,
  type WalletStats,
  type WalletTransaction,
} from "@/lib/api";
import {
  formatAddress,
  formatEth,
  getRiskColor,
  getRiskLevel,
  getStatusColor,
  formatDate,
} from "@/lib/utils";

export default function AdminTracking() {
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Fetch wallets under monitoring (under_review or suspended)
  const { data: monitoredWallets, isLoading } = useQuery<Wallet[]>({
    queryKey: ["monitoredWallets"],
    queryFn: async () => {
      const underReview = await fetchWallets({ account_status: "under_review", limit: 50 });
      const suspended = await fetchWallets({ account_status: "suspended", limit: 50 });
      const frozen = await fetchWallets({ account_status: "frozen", limit: 50 });
      return [...underReview, ...suspended, ...frozen];
    },
    refetchInterval: 30000,
  });

  // Fetch connections for selected wallet
  const { data: connections, isLoading: connectionsLoading } =
    useQuery<WalletConnectionsResponse>({
      queryKey: ["walletConnections", selectedWallet?.address],
      queryFn: () => fetchWalletConnections(selectedWallet!.address),
      enabled: !!selectedWallet,
    });

  // Fetch wallet stats (ETH sent/received)
  const { data: walletStats, isLoading: statsLoading } = useQuery<WalletStats>({
    queryKey: ["walletStats", selectedWallet?.address],
    queryFn: () => fetchWalletStats(selectedWallet!.address),
    enabled: !!selectedWallet,
  });

  // Fetch transaction history
  const { data: transactions, isLoading: txLoading } = useQuery<WalletTransaction[]>({
    queryKey: ["walletTransactions", selectedWallet?.address],
    queryFn: () => fetchWalletTransactionHistory(selectedWallet!.address, 50),
    enabled: !!selectedWallet,
  });

  // Filter incoming connections
  const incomingConnections = connections?.connections.filter(c => c.direction === "incoming") || [];
  const outgoingConnections = connections?.connections.filter(c => c.direction === "outgoing") || [];

  const handleWalletClick = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100">
          Wallet <span className="text-cyan-400">Tracking</span>
        </h1>
        <p className="text-slate-400 mt-1">
          Monitor flagged wallets and their network connections
        </p>
      </div>

      {/* Monitoring Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:border-amber-500/60">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Eye className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">
                {monitoredWallets?.filter((w) => w.account_status === "under_review")
                  .length || 0}
              </p>
              <p className="text-sm text-slate-400">Under Review</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/30 bg-orange-500/5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:border-orange-500/60">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <AlertTriangle className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-400">
                {monitoredWallets?.filter((w) => w.account_status === "suspended")
                  .length || 0}
              </p>
              <p className="text-sm text-slate-400">Suspended</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/30 bg-cyan-500/5 transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:border-cyan-500/60">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Radar className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">
                {monitoredWallets?.length || 0}
              </p>
              <p className="text-sm text-slate-400">Total Monitored</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet List */}
      <Card className="border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-cyan-400" />
            Monitored Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Radar className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
          ) : monitoredWallets?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No wallets currently under monitoring</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitoredWallets?.map((wallet) => (
                <div
                  key={wallet.id}
                  onClick={() => handleWalletClick(wallet)}
                  className="group cursor-pointer rounded-xl border border-slate-700 bg-slate-800/80 p-4 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)] hover:bg-slate-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-slate-700 border border-slate-600 group-hover:border-cyan-500/30">
                        <WalletIcon className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-mono text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                          {formatAddress(wallet.address)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {wallet.label || wallet.entity_type}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(wallet.account_status)}>
                      {wallet.account_status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-slate-400">Risk Score</p>
                      <p
                        className={`text-lg font-bold ${getRiskColor(
                          wallet.risk_score
                        )}`}
                      >
                        {wallet.risk_score.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Transactions</p>
                      <p className="text-lg font-bold text-slate-100">
                        {wallet.total_transactions || 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(wallet.last_activity_at)}
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Details
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet Detail Sheet (Overlay) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedWallet && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <WalletIcon className="h-5 w-5 text-cyan-400" />
                  Wallet Details
                </SheetTitle>
                <SheetDescription className="font-mono">
                  {selectedWallet.address}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Wallet Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 mb-1">Risk Score</p>
                    <p
                      className={`text-3xl font-bold ${getRiskColor(
                        selectedWallet.risk_score
                      )}`}
                    >
                      {selectedWallet.risk_score.toFixed(0)}
                    </p>
                    <Badge
                      variant={
                        selectedWallet.risk_score >= 90
                          ? "critical"
                          : selectedWallet.risk_score >= 70
                            ? "high"
                            : "medium"
                      }
                      className="mt-2"
                    >
                      {getRiskLevel(selectedWallet.risk_score)}
                    </Badge>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    <Badge
                      className={`text-lg px-3 py-1 ${getStatusColor(
                        selectedWallet.account_status
                      )}`}
                    >
                      {selectedWallet.account_status.replace("_", " ")}
                    </Badge>
                    <p className="text-xs text-slate-400 mt-2">
                      Type: {selectedWallet.entity_type}
                    </p>
                  </div>
                </div>

                {/* Transaction Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-center">
                    <Activity className="h-5 w-5 mx-auto mb-1 text-cyan-400" />
                    <p className="text-lg font-bold text-slate-100">
                      {walletStats?.total_transactions ?? selectedWallet.total_transactions ?? 0}
                    </p>
                    <p className="text-xs text-slate-400">Transactions</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-center">
                    <ArrowUpRight className="h-5 w-5 mx-auto mb-1 text-red-400" />
                    <p className="text-lg font-bold text-red-400">
                      {statsLoading ? "..." : walletStats?.eth_sent?.toFixed(4) ?? "0"} ETH
                    </p>
                    <p className="text-xs text-slate-400">ETH Sent ({walletStats?.sent_count ?? 0} txs)</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-center">
                    <ArrowDownLeft className="h-5 w-5 mx-auto mb-1 text-emerald-400" />
                    <p className="text-lg font-bold text-emerald-400">
                      {statsLoading ? "..." : walletStats?.eth_received?.toFixed(4) ?? "0"} ETH
                    </p>
                    <p className="text-xs text-slate-400">ETH Received ({walletStats?.received_count ?? 0} txs)</p>
                  </div>
                </div>

                <Separator />

                {/* Tabs for Connections and Transaction History */}
                <Tabs defaultValue="connections" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="connections">
                      <Link2 className="h-4 w-4 mr-2" />
                      All Connections
                    </TabsTrigger>
                    <TabsTrigger value="incoming">
                      <ArrowDownLeft className="h-4 w-4 mr-2" />
                      Incoming ({incomingConnections.length})
                    </TabsTrigger>
                    <TabsTrigger value="history">
                      <History className="h-4 w-4 mr-2" />
                      Transaction History
                    </TabsTrigger>
                  </TabsList>

                  {/* All Connections Tab */}
                  <TabsContent value="connections" className="mt-4">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-cyan-400" />
                      Network Connections
                      {connections && (
                        <Badge variant="secondary">
                          {connections.total_connections} connections
                        </Badge>
                      )}
                    </h3>

                    {connectionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Radar className="h-6 w-6 animate-spin text-cyan-400" />
                      </div>
                    ) : connections?.connections.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">
                        No connections found
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {connections?.connections.map((conn, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-3 rounded-lg border ${conn.risk_score >= 70
                              ? "border-red-500/30 bg-red-500/5"
                              : conn.risk_score >= 50
                                ? "border-orange-500/30 bg-orange-500/5"
                                : "border-slate-700 bg-slate-800"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg ${conn.direction === "outgoing"
                                  ? "bg-red-500/10"
                                  : "bg-emerald-500/10"
                                  }`}
                              >
                                {conn.direction === "outgoing" ? (
                                  <ArrowUpRight
                                    className={`h-4 w-4 ${conn.direction === "outgoing"
                                      ? "text-red-400"
                                      : "text-emerald-400"
                                      }`}
                                  />
                                ) : (
                                  <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-mono text-sm text-slate-100">
                                  {formatAddress(conn.address)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-400">
                                    {conn.label || conn.entity_type}
                                  </span>
                                  <Badge
                                    className={getStatusColor(conn.account_status)}
                                    variant="outline"
                                  >
                                    {conn.account_status}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-sm font-bold ${getRiskColor(
                                  conn.risk_score
                                )}`}
                              >
                                Risk: {conn.risk_score.toFixed(0)}
                              </p>
                              <p className="text-xs text-slate-400">
                                {conn.tx_count} txs • {conn.total_value_eth.toFixed(2)}{" "}
                                ETH
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Incoming Transfers Tab */}
                  <TabsContent value="incoming" className="mt-4">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-emerald-400" />
                      Wallets That Sent To This Account
                      <Badge variant="secondary">{incomingConnections.length} sources</Badge>
                    </h3>

                    {connectionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Radar className="h-6 w-6 animate-spin text-cyan-400" />
                      </div>
                    ) : incomingConnections.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">
                        No incoming transfers found
                      </p>
                    ) : (
                      <>
                        {/* Summary Bar Chart */}
                        <div className="mb-4 p-4 rounded-lg border border-slate-700 bg-slate-800">
                          <p className="text-sm text-slate-400 mb-3">Incoming ETH by Source</p>
                          <div className="space-y-2">
                            {incomingConnections.slice(0, 5).map((conn, idx) => {
                              const maxEth = Math.max(...incomingConnections.map(c => c.total_value_eth));
                              const widthPercent = maxEth > 0 ? (conn.total_value_eth / maxEth) * 100 : 0;
                              return (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-slate-400 w-24 truncate">
                                    {formatAddress(conn.address)}
                                  </span>
                                  <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500/60 rounded"
                                      style={{ width: `${widthPercent}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-emerald-400 font-bold w-20 text-right">
                                    {conn.total_value_eth.toFixed(4)} ETH
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Incoming List */}
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                          {incomingConnections.map((conn, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-3 rounded-lg border ${conn.risk_score >= 70
                                ? "border-red-500/30 bg-red-500/5"
                                : "border-emerald-500/30 bg-emerald-500/5"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                  <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div>
                                  <p className="font-mono text-sm text-slate-100">
                                    {formatAddress(conn.address)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {conn.label || conn.entity_type}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-400">
                                  +{conn.total_value_eth.toFixed(4)} ETH
                                </p>
                                <p className="text-xs text-slate-400">
                                  {conn.tx_count} transactions
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Transaction History Tab */}
                  <TabsContent value="history" className="mt-4">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                      <History className="h-5 w-5 text-cyan-400" />
                      Transaction History
                      <Badge variant="secondary">{transactions?.length ?? 0} transactions</Badge>
                    </h3>

                    {txLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Radar className="h-6 w-6 animate-spin text-cyan-400" />
                      </div>
                    ) : !transactions || transactions.length === 0 ? (
                      <p className="text-center py-8 text-slate-400">
                        No transactions found
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {transactions.map((tx, idx) => (
                          <div
                            key={tx.tx_hash || idx}
                            className={`flex items-center justify-between p-3 rounded-lg border ${tx.is_flagged
                              ? "border-red-500/30 bg-red-500/5"
                              : "border-slate-700 bg-slate-800"
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2 rounded-lg ${tx.direction === "sent"
                                  ? "bg-red-500/10"
                                  : "bg-emerald-500/10"
                                  }`}
                              >
                                {tx.direction === "sent" ? (
                                  <ArrowUpRight className="h-4 w-4 text-red-400" />
                                ) : (
                                  <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-sm text-slate-100">
                                    {tx.direction === "sent" ? "To: " : "From: "}
                                    {formatAddress(tx.counterparty)}
                                  </p>
                                  {tx.counterparty_risk >= 70 && (
                                    <Badge variant="destructive" className="text-xs">
                                      High Risk
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400">
                                  {tx.timestamp ? formatDate(tx.timestamp) : "Unknown date"}
                                  {tx.is_flagged && (
                                    <span className="text-red-400 ml-2">
                                      ⚠ {tx.flag_reason}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-sm font-bold ${tx.direction === "sent"
                                  ? "text-red-400"
                                  : "text-emerald-400"
                                  }`}
                              >
                                {tx.direction === "sent" ? "-" : "+"}
                                {tx.value_eth.toFixed(4)} ETH
                              </p>
                              <p className="text-xs font-mono text-slate-400 truncate max-w-[100px]">
                                {tx.tx_hash ? `${tx.tx_hash.slice(0, 10)}...` : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

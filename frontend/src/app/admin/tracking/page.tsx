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
  fetchWallets,
  fetchWalletConnections,
  type Wallet,
  type WalletConnectionsResponse,
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
      return [...underReview, ...suspended];
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

  const handleWalletClick = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setIsSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-cyber-text-primary">
          Wallet <span className="text-cyber-neon-cyan">Tracking</span>
        </h1>
        <p className="text-cyber-text-secondary mt-1">
          Monitor flagged wallets and their network connections
        </p>
      </div>

      {/* Monitoring Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-cyber-neon-yellow/30 bg-cyber-neon-yellow/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-yellow/10 border border-cyber-neon-yellow/30">
              <Eye className="h-6 w-6 text-cyber-neon-yellow" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-yellow">
                {monitoredWallets?.filter((w) => w.account_status === "under_review")
                  .length || 0}
              </p>
              <p className="text-sm text-cyber-text-muted">Under Review</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-neon-orange/30 bg-cyber-neon-orange/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-orange/10 border border-cyber-neon-orange/30">
              <AlertTriangle className="h-6 w-6 text-cyber-neon-orange" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-orange">
                {monitoredWallets?.filter((w) => w.account_status === "suspended")
                  .length || 0}
              </p>
              <p className="text-sm text-cyber-text-muted">Suspended</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-neon-cyan/30 bg-cyber-neon-cyan/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-cyan/10 border border-cyber-neon-cyan/30">
              <Radar className="h-6 w-6 text-cyber-neon-cyan" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-cyan">
                {monitoredWallets?.length || 0}
              </p>
              <p className="text-sm text-cyber-text-muted">Total Monitored</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet List */}
      <Card className="border-cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-cyber-neon-cyan" />
            Monitored Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Radar className="h-8 w-8 animate-spin text-cyber-neon-cyan" />
            </div>
          ) : monitoredWallets?.length === 0 ? (
            <div className="text-center py-12 text-cyber-text-muted">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No wallets currently under monitoring</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitoredWallets?.map((wallet) => (
                <div
                  key={wallet.id}
                  onClick={() => handleWalletClick(wallet)}
                  className="group cursor-pointer rounded-xl border border-cyber-border bg-cyber-bg-elevated p-4 hover:border-cyber-neon-cyan/50 hover:shadow-neon-cyan transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-cyber-bg-card border border-cyber-border group-hover:border-cyber-neon-cyan/30">
                        <WalletIcon className="h-4 w-4 text-cyber-neon-cyan" />
                      </div>
                      <div>
                        <p className="font-mono text-sm text-cyber-text-primary group-hover:text-cyber-neon-cyan transition-colors">
                          {formatAddress(wallet.address)}
                        </p>
                        <p className="text-xs text-cyber-text-muted">
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
                      <p className="text-xs text-cyber-text-muted">Risk Score</p>
                      <p
                        className={`text-lg font-bold ${getRiskColor(
                          wallet.risk_score
                        )}`}
                      >
                        {wallet.risk_score.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-cyber-text-muted">Transactions</p>
                      <p className="text-lg font-bold text-cyber-text-primary">
                        {wallet.total_transactions || 0}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-cyber-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(wallet.last_activity_at)}
                    </span>
                    <span className="flex items-center gap-1 text-cyber-neon-cyan opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <WalletIcon className="h-5 w-5 text-cyber-neon-cyan" />
                  Wallet Details
                </SheetTitle>
                <SheetDescription className="font-mono">
                  {selectedWallet.address}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Wallet Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-cyber-border bg-cyber-bg-elevated p-4">
                    <p className="text-xs text-cyber-text-muted mb-1">Risk Score</p>
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

                  <div className="rounded-lg border border-cyber-border bg-cyber-bg-elevated p-4">
                    <p className="text-xs text-cyber-text-muted mb-1">Status</p>
                    <Badge
                      className={`text-lg px-3 py-1 ${getStatusColor(
                        selectedWallet.account_status
                      )}`}
                    >
                      {selectedWallet.account_status.replace("_", " ")}
                    </Badge>
                    <p className="text-xs text-cyber-text-muted mt-2">
                      Type: {selectedWallet.entity_type}
                    </p>
                  </div>
                </div>

                {/* Transaction Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-cyber-border bg-cyber-bg-card p-3 text-center">
                    <Activity className="h-5 w-5 mx-auto mb-1 text-cyber-neon-cyan" />
                    <p className="text-lg font-bold text-cyber-text-primary">
                      {selectedWallet.total_transactions || 0}
                    </p>
                    <p className="text-xs text-cyber-text-muted">Transactions</p>
                  </div>
                  <div className="rounded-lg border border-cyber-border bg-cyber-bg-card p-3 text-center">
                    <ArrowUpRight className="h-5 w-5 mx-auto mb-1 text-cyber-neon-red" />
                    <p className="text-lg font-bold text-cyber-text-primary">
                      N/A
                    </p>
                    <p className="text-xs text-cyber-text-muted">ETH Sent</p>
                  </div>
                  <div className="rounded-lg border border-cyber-border bg-cyber-bg-card p-3 text-center">
                    <ArrowDownLeft className="h-5 w-5 mx-auto mb-1 text-cyber-neon-green" />
                    <p className="text-lg font-bold text-cyber-text-primary">
                      N/A
                    </p>
                    <p className="text-xs text-cyber-text-muted">ETH Received</p>
                  </div>
                </div>

                <Separator />

                {/* Network Connections */}
                <div>
                  <h3 className="text-lg font-semibold text-cyber-text-primary mb-4 flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-cyber-neon-cyan" />
                    Network Connections
                    {connections && (
                      <Badge variant="secondary">
                        {connections.total_connections} connections
                      </Badge>
                    )}
                  </h3>

                  {connectionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Radar className="h-6 w-6 animate-spin text-cyber-neon-cyan" />
                    </div>
                  ) : connections?.connections.length === 0 ? (
                    <p className="text-center py-8 text-cyber-text-muted">
                      No connections found
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {connections?.connections.map((conn, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-lg border ${conn.risk_score >= 70
                            ? "border-cyber-neon-red/30 bg-cyber-neon-red/5"
                            : conn.risk_score >= 50
                              ? "border-cyber-neon-orange/30 bg-cyber-neon-orange/5"
                              : "border-cyber-border bg-cyber-bg-elevated"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${conn.direction === "outgoing"
                                ? "bg-cyber-neon-red/10"
                                : "bg-cyber-neon-green/10"
                                }`}
                            >
                              {conn.direction === "outgoing" ? (
                                <ArrowUpRight
                                  className={`h-4 w-4 ${conn.direction === "outgoing"
                                    ? "text-cyber-neon-red"
                                    : "text-cyber-neon-green"
                                    }`}
                                />
                              ) : (
                                <ArrowDownLeft className="h-4 w-4 text-cyber-neon-green" />
                              )}
                            </div>
                            <div>
                              <p className="font-mono text-sm text-cyber-text-primary">
                                {formatAddress(conn.address)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-cyber-text-muted">
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
                            <p className="text-xs text-cyber-text-muted">
                              {conn.tx_count} txs • {conn.total_value_eth.toFixed(2)}{" "}
                              ETH
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Droplets,
  TrendingUp,
  Fish,
  AlertTriangle,
  ShieldAlert,
  Ban,
  Activity,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchDashboardStats,
  fetchWallets,
  updateWalletStatus,
  fetchLatestAlerts,
  type DashboardStats,
  type Wallet,
  type Alert,
} from "@/lib/api";
import {
  formatAddress,
  formatNumber,
  getRiskColor,
  getRiskLevel,
  getStatusColor,
  formatDate,
} from "@/lib/utils";

const categoryIcons = {
  money_laundering: Droplets,
  manipulation: TrendingUp,
  scam: Fish,
};

const categoryColors = {
  money_laundering: "cyan",
  manipulation: "orange",
  scam: "red",
} as const;

const statusOptions = [
  { value: "active", label: "Active", color: "text-cyber-neon-green" },
  { value: "under_review", label: "Under Review", color: "text-cyber-neon-yellow" },
  { value: "suspended", label: "Suspended", color: "text-cyber-neon-orange" },
  { value: "frozen", label: "Frozen", color: "text-cyber-neon-red" },
];

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch wallets
  const { data: wallets, isLoading: walletsLoading } = useQuery<Wallet[]>({
    queryKey: ["wallets", categoryFilter, statusFilter],
    queryFn: () =>
      fetchWallets({
        risk_category: categoryFilter !== "all" ? categoryFilter : undefined,
        account_status: statusFilter !== "all" ? statusFilter : undefined,
        min_risk_score: 50,
        limit: 100,
      }),
    refetchInterval: 30000,
  });

  // Fetch latest alerts
  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ["latestAlerts"],
    queryFn: fetchLatestAlerts,
    refetchInterval: 10000, // Refresh every 10s
  });

  // Update wallet status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ address, status }: { address: string; status: string }) =>
      updateWalletStatus(address, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
    },
  });

  const handleStatusChange = (address: string, newStatus: string) => {
    updateStatusMutation.mutate({ address, status: newStatus });
  };

  // Filter wallets by search
  const filteredWallets = wallets?.filter(
    (w) =>
      w.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.label?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyber-text-primary">
            AI Detection <span className="text-cyber-neon-cyan">Dashboard</span>
          </h1>
          <p className="text-cyber-text-secondary mt-1">
            Multi-agent fraud detection overview
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid - 4 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Money Laundering Card */}
        <Card glow="cyan" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-neon-cyan/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-text-secondary">
              Money Laundering
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyber-neon-cyan/10 border border-cyber-neon-cyan/30">
              <Droplets className="h-5 w-5 text-cyber-neon-cyan" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-neon-cyan">
              {statsLoading ? "..." : stats?.money_laundering.wallet_count || 0}
            </div>
            <p className="text-xs text-cyber-text-muted mt-1">
              {stats?.money_laundering.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Manipulation Card */}
        <Card glow="orange" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-neon-orange/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-text-secondary">
              Market Manipulation
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyber-neon-orange/10 border border-cyber-neon-orange/30">
              <TrendingUp className="h-5 w-5 text-cyber-neon-orange" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-neon-orange">
              {statsLoading ? "..." : stats?.manipulation.wallet_count || 0}
            </div>
            <p className="text-xs text-cyber-text-muted mt-1">
              {stats?.manipulation.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Scam Card */}
        <Card glow="red" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-neon-red/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-text-secondary">
              Scam Detection
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyber-neon-red/10 border border-cyber-neon-red/30">
              <Fish className="h-5 w-5 text-cyber-neon-red" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-neon-red">
              {statsLoading ? "..." : stats?.scam.wallet_count || 0}
            </div>
            <p className="text-xs text-cyber-text-muted mt-1">
              {stats?.scam.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Overview Card */}
        <Card glow="purple" className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyber-neon-purple/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyber-text-secondary">
              Total Overview
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyber-neon-purple/10 border border-cyber-neon-purple/30">
              <Activity className="h-5 w-5 text-cyber-neon-purple" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyber-neon-purple">
              {statsLoading ? "..." : stats?.overview.total_wallets || 0}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-cyber-neon-red flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats?.overview.critical_alerts || 0} critical
              </span>
              <span className="text-xs text-cyber-text-muted">
                {stats?.overview.total_blocked || 0} blocked
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Ticker */}
      {alerts && alerts.length > 0 && (
        <div className="bg-cyber-bg-darker border border-cyber-border rounded-lg p-3 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <ShieldAlert className="h-5 w-5 text-cyber-neon-red animate-pulse" />
              <span className="text-sm font-medium text-cyber-text-primary">
                Latest Alerts
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex gap-6 animate-marquee">
                {alerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <Badge
                      variant={
                        alert.severity === "CRITICAL"
                          ? "critical"
                          : alert.severity === "HIGH"
                            ? "high"
                            : "medium"
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <span className="text-sm text-cyber-text-secondary">
                      {formatAddress(alert.wallet_address)} - {alert.alert_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspicious Accounts Table */}
      <Card className="border-cyber-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-cyber-neon-red" />
              Suspicious Accounts
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyber-text-muted" />
                <Input
                  placeholder="Search address..."
                  className="pl-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="money_laundering">
                    Money Laundering
                  </SelectItem>
                  <SelectItem value="manipulation">Manipulation</SelectItem>
                  <SelectItem value="scam">Scam</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyber-neon-cyan" />
                  </TableCell>
                </TableRow>
              ) : filteredWallets?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-cyber-text-muted"
                  >
                    No suspicious accounts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWallets?.map((wallet) => {
                  const CategoryIcon = wallet.risk_category
                    ? categoryIcons[
                    wallet.risk_category as keyof typeof categoryIcons
                    ]
                    : AlertTriangle;

                  return (
                    <TableRow key={wallet.id}>
                      <TableCell className="font-mono text-sm">
                        {formatAddress(wallet.address)}
                      </TableCell>
                      <TableCell>
                        {wallet.label || (
                          <span className="text-cyber-text-muted">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wallet.risk_category ? (
                          <div className="flex items-center gap-2">
                            <CategoryIcon className="h-4 w-4" />
                            <span className="capitalize text-sm">
                              {wallet.risk_category.replace("_", " ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-cyber-text-muted">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${getRiskColor(
                              wallet.risk_score
                            )}`}
                          >
                            {wallet.risk_score.toFixed(0)}
                          </span>
                          <Badge
                            variant={
                              wallet.risk_score >= 90
                                ? "critical"
                                : wallet.risk_score >= 70
                                  ? "high"
                                  : wallet.risk_score >= 50
                                    ? "medium"
                                    : "low"
                            }
                          >
                            {getRiskLevel(wallet.risk_score)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatNumber(wallet.total_transactions || 0)}
                      </TableCell>
                      <TableCell className="text-cyber-text-muted text-sm">
                        {formatDate(wallet.last_activity_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getStatusColor(wallet.account_status)}
                        >
                          {wallet.account_status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={wallet.account_status}
                          onValueChange={(value) =>
                            handleStatusChange(wallet.address, value)
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                <span className={s.color}>{s.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

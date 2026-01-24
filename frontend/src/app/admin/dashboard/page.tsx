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

const statusOptions = [
  { value: "active", label: "Active", color: "text-emerald-400" },
  { value: "under_review", label: "Under Review", color: "text-amber-400" },
  { value: "suspended", label: "Suspended", color: "text-orange-400" },
  { value: "frozen", label: "Frozen", color: "text-red-400" },
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
    refetchInterval: 30000,
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
    refetchInterval: 10000,
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
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            AI Detection Dashboard
          </h1>
          <p className="text-slate-400 mt-1">
            Multi-agent fraud detection overview
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="btn-glow text-slate-300 border-slate-600 hover:bg-slate-800 hover:text-white hover:border-cyan-500/50"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            queryClient.invalidateQueries({ queryKey: ["wallets"] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Money Laundering Card */}
        <Card className="glass-card glass-card-hover border-cyan-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Money Laundering
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
              <Droplets className="h-5 w-5 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {statsLoading ? "..." : stats?.money_laundering.wallet_count || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.money_laundering.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Manipulation Card */}
        <Card className="glass-card glass-card-hover border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Market Manipulation
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30">
              <TrendingUp className="h-5 w-5 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {statsLoading ? "..." : stats?.manipulation.wallet_count || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.manipulation.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Scam Card */}
        <Card className="glass-card glass-card-hover border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Scam Detection
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30">
              <Fish className="h-5 w-5 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {statsLoading ? "..." : stats?.scam.wallet_count || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {stats?.scam.alert_count || 0} alerts detected
            </p>
          </CardContent>
        </Card>

        {/* Overview Card */}
        <Card className="glass-card glass-card-hover border-violet-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Total Overview
            </CardTitle>
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30">
              <Activity className="h-5 w-5 text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {statsLoading ? "..." : stats?.overview.total_wallets || 0}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats?.overview.critical_alerts || 0} critical
              </span>
              <span className="text-xs text-slate-500">
                {stats?.overview.total_blocked || 0} blocked
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Ticker */}
      {alerts && alerts.length > 0 && (
        <div className="glass-card rounded-xl p-4 overflow-hidden animate-fade-in border-red-500/20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 animate-pulse-glow">
                <ShieldAlert className="h-5 w-5 text-red-400" />
              </div>
              <span className="text-sm font-medium text-white">
                Latest Alerts
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex gap-6">
                {alerts.slice(0, 3).map((alert) => (
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
                    <span className="text-sm text-slate-400">
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
      <Card className="glass-card glass-card-hover animate-slide-up border-slate-700/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Ban className="h-5 w-5 text-red-400" />
              Suspicious Accounts
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search address..."
                  className="pl-9 w-64 bg-slate-800 border-slate-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 bg-slate-800 border-slate-600">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="money_laundering">Money Laundering</SelectItem>
                  <SelectItem value="manipulation">Manipulation</SelectItem>
                  <SelectItem value="scam">Scam</SelectItem>
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-600">
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
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-300">Address</TableHead>
                <TableHead className="text-slate-300">Label</TableHead>
                <TableHead className="text-slate-300">Category</TableHead>
                <TableHead className="text-slate-300">Risk Score</TableHead>
                <TableHead className="text-slate-300">Transactions</TableHead>
                <TableHead className="text-slate-300">Last Seen</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
                  </TableCell>
                </TableRow>
              ) : filteredWallets?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-slate-500"
                  >
                    No suspicious accounts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWallets?.map((wallet) => {
                  const CategoryIcon = wallet.risk_category
                    ? categoryIcons[wallet.risk_category as keyof typeof categoryIcons]
                    : AlertTriangle;

                  return (
                    <TableRow key={wallet.id} className="border-slate-700/50">
                      <TableCell className="font-mono text-sm text-slate-300">
                        {formatAddress(wallet.address)}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {wallet.label || <span className="text-slate-500">-</span>}
                      </TableCell>
                      <TableCell>
                        {wallet.risk_category ? (
                          <div className="flex items-center gap-2 text-slate-300">
                            <CategoryIcon className="h-4 w-4" />
                            <span className="capitalize text-sm">
                              {wallet.risk_category.replace("_", " ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${getRiskColor(wallet.risk_score)}`}>
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
                      <TableCell className="text-slate-300">
                        {formatNumber(wallet.total_transactions || 0)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {formatDate(wallet.last_activity_at)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(wallet.account_status)}>
                          {wallet.account_status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={wallet.account_status}
                          onValueChange={(value) => handleStatusChange(wallet.address, value)}
                        >
                          <SelectTrigger className="w-32 h-8 bg-slate-800 border-slate-600">
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

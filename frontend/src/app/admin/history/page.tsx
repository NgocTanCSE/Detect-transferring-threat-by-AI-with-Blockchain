"use client";

import { useQuery } from "@tanstack/react-query";
import {
  History,
  Ban,
  TrendingUp,
  Calendar,
  AlertOctagon,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchBlockedTransfers,
  fetchFlowStats,
  type BlockedTransfer,
  type FlowStats,
} from "@/lib/api";
import { formatAddress, getRiskColor, formatDate } from "@/lib/utils";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

export default function AdminHistory() {
  // Fetch blocked transfers
  const { data: blockedTransfers, isLoading: blockedLoading } = useQuery<
    BlockedTransfer[]
  >({
    queryKey: ["blockedTransfers"],
    queryFn: fetchBlockedTransfers,
    refetchInterval: 30000,
  });

  // Fetch flow stats
  const { data: flowStats, isLoading: flowLoading } = useQuery<FlowStats[]>({
    queryKey: ["flowStats"],
    queryFn: fetchFlowStats,
  });

  // Calculate summary stats
  const totalBlocked = blockedTransfers?.length || 0;
  const totalBlockedValue = blockedTransfers?.reduce(
    (sum, t) => sum + (t.amount_eth || 0),
    0
  ) || 0;
  const avgRiskScore =
    totalBlocked > 0
      ? blockedTransfers!.reduce((sum, t) => sum + t.risk_score, 0) / totalBlocked
      : 0;

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value.toFixed(2)} ETH
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">
          Transaction History
        </h1>
        <p className="text-slate-400 mt-1">
          Blocked transfers and money flow analytics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Ban className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {totalBlocked}
              </p>
              <p className="text-sm text-slate-400">Total Blocked</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertOctagon className="h-6 w-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {totalBlockedValue.toFixed(4)}
              </p>
              <p className="text-sm text-slate-400">ETH Protected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <TrendingUp className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {avgRiskScore.toFixed(1)}
              </p>
              <p className="text-sm text-slate-400">Avg Risk Score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Chart */}
      <Card className="border-slate-700/50 bg-slate-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-cyan-400" />
            Money Flow Analysis
          </CardTitle>
          <CardDescription className="text-slate-400">
            Daily inflow and outflow volume across monitored wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flowLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
            </div>
          ) : flowStats && flowStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={flowStats}>
                <defs>
                  <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "#334155" }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "#334155" }}
                  tickFormatter={(value) => `${value} ETH`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  name="Inflow"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#inflowGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  name="Outflow"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#outflowGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No flow data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Transfers Table */}
      <Card className="border-slate-700/50 bg-slate-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <History className="h-5 w-5 text-red-400" />
            Blocked Transfers History
          </CardTitle>
          <CardDescription className="text-slate-400">
            All transfers that were blocked by the AI protection system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700">
                <TableHead className="text-slate-300">Time</TableHead>
                <TableHead className="text-slate-300">From</TableHead>
                <TableHead></TableHead>
                <TableHead className="text-slate-300">To</TableHead>
                <TableHead className="text-slate-300">Amount</TableHead>
                <TableHead className="text-slate-300">Risk Score</TableHead>
                <TableHead className="text-slate-300">Block Reason</TableHead>
                <TableHead className="text-slate-300">Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : blockedTransfers?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-slate-400"
                  >
                    <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No blocked transfers found</p>
                    <p className="text-sm mt-1">
                      Blocked transfers will appear here when detected
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                blockedTransfers?.map((transfer) => (
                  <TableRow key={transfer.id} className="border-slate-700/50">
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {formatDate(transfer.blocked_at)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-300">
                      {formatAddress(transfer.sender_address)}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-red-400" />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-300">
                      {formatAddress(transfer.receiver_address)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-white">
                        {transfer.amount_eth?.toFixed(4) || '0.0000'} ETH
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-semibold ${getRiskColor(transfer.risk_score)}`}
                      >
                        {transfer.risk_score.toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {transfer.block_reason.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i <= transfer.user_warning_count
                              ? "bg-red-400"
                              : "bg-slate-600"
                              }`}
                          />
                        ))}
                        <span className="text-xs text-slate-500 ml-1">
                          {transfer.user_warning_count}/3
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

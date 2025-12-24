"use client";

import { useQuery } from "@tanstack/react-query";
import {
  History,
  Ban,
  TrendingUp,
  TrendingDown,
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
import { formatAddress, formatEth, getRiskColor, formatDate } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-cyber-bg-card border border-cyber-border rounded-lg p-3 shadow-lg">
          <p className="text-cyber-text-primary font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
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
        <h1 className="text-3xl font-bold text-cyber-text-primary">
          Transaction <span className="text-cyber-neon-cyan">History</span>
        </h1>
        <p className="text-cyber-text-secondary mt-1">
          Blocked transfers and money flow analytics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-cyber-neon-red/30 bg-cyber-neon-red/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-red/10 border border-cyber-neon-red/30">
              <Ban className="h-6 w-6 text-cyber-neon-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-red">
                {totalBlocked}
              </p>
              <p className="text-sm text-cyber-text-muted">Total Blocked</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-neon-orange/30 bg-cyber-neon-orange/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-orange/10 border border-cyber-neon-orange/30">
              <AlertOctagon className="h-6 w-6 text-cyber-neon-orange" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-orange">
                {totalBlockedValue.toFixed(4)}
              </p>
              <p className="text-sm text-cyber-text-muted">ETH Protected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyber-neon-cyan/30 bg-cyber-neon-cyan/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyber-neon-cyan/10 border border-cyber-neon-cyan/30">
              <TrendingUp className="h-6 w-6 text-cyber-neon-cyan" />
            </div>
            <div>
              <p className="text-2xl font-bold text-cyber-neon-cyan">
                {avgRiskScore.toFixed(1)}
              </p>
              <p className="text-sm text-cyber-text-muted">Avg Risk Score</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flow Chart */}
      <Card className="border-cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-cyber-neon-cyan" />
            Money Flow Analysis
          </CardTitle>
          <CardDescription>
            Daily inflow and outflow volume across monitored wallets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flowLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyber-neon-cyan" />
            </div>
          ) : flowStats && flowStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={flowStats}>
                <defs>
                  <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff0040" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff0040" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1a1a2e"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#606070"
                  tick={{ fill: "#a0a0b0", fontSize: 12 }}
                  axisLine={{ stroke: "#1a1a2e" }}
                />
                <YAxis
                  stroke="#606070"
                  tick={{ fill: "#a0a0b0", fontSize: 12 }}
                  axisLine={{ stroke: "#1a1a2e" }}
                  tickFormatter={(value) => `${value} ETH`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span className="text-cyber-text-secondary">{value}</span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  name="Inflow"
                  stroke="#00ff88"
                  strokeWidth={2}
                  fill="url(#inflowGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  name="Outflow"
                  stroke="#ff0040"
                  strokeWidth={2}
                  fill="url(#outflowGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-cyber-text-muted">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No flow data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Transfers Table */}
      <Card className="border-cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-cyber-neon-red" />
            Blocked Transfers History
          </CardTitle>
          <CardDescription>
            All transfers that were blocked by the AI protection system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>From</TableHead>
                <TableHead></TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Block Reason</TableHead>
                <TableHead>Warnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyber-neon-cyan mx-auto" />
                  </TableCell>
                </TableRow>
              ) : blockedTransfers?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-cyber-text-muted"
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
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 text-cyber-text-muted">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {formatDate(transfer.blocked_at)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatAddress(transfer.sender_address)}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-cyber-neon-red" />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatAddress(transfer.receiver_address)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-cyber-text-primary">
                        {transfer.amount_eth?.toFixed(4) || '0.0000'} ETH
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-bold ${getRiskColor(transfer.risk_score)}`}
                      >
                        {transfer.risk_score.toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transfer.block_reason.includes("blacklist")
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {transfer.block_reason.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i <= transfer.user_warning_count
                              ? "bg-cyber-neon-red"
                              : "bg-cyber-border"
                              }`}
                          />
                        ))}
                        <span className="text-xs text-cyber-text-muted ml-1">
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

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Ban,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Shield,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchUserHistory, fetchWalletBalance, type UserHistory, type WalletBalance } from "@/lib/api";
import { formatAddress, formatDate, getRiskColor } from "@/lib/utils";

// Demo wallet - in real app this would come from auth context
const DEFAULT_WALLET = "0x742d35cc6634c0532925a3b844bc454e4438f44e";

export default function UserHistoryPage() {
  const [walletAddress, setWalletAddress] = useState(DEFAULT_WALLET);
  const [inputAddress, setInputAddress] = useState(DEFAULT_WALLET);

  // Using 'any' type since API response structure doesn't match strict type definition
  const { data: history, isLoading, refetch } = useQuery<any>({
    queryKey: ["userHistory", walletAddress],
    queryFn: () => fetchUserHistory(walletAddress),
    enabled: !!walletAddress,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery<any>({
    queryKey: ["walletBalance", walletAddress],
    queryFn: () => fetchWalletBalance(walletAddress),
    enabled: !!walletAddress,
  });

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputAddress(value);

    // Tự động tìm kiếm khi nhập đủ 42 ký tự (địa chỉ Ethereum hợp lệ)
    if (value.length === 42 && value.startsWith("0x")) {
      setWalletAddress(value.toLowerCase());
    }
  };

  const handleSearch = () => {
    if (inputAddress && inputAddress.startsWith("0x")) {
      setWalletAddress(inputAddress.toLowerCase());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Transaction History
          </h1>
          <p className="text-slate-400 mt-1">
            View your transaction history and blocked transfers
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Wallet Search */}
      <Card className="border-slate-700/50 bg-slate-800/30">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Input
              placeholder="Enter wallet address (0x...)"
              value={inputAddress}
              onChange={handleAddressChange}
              className="font-mono text-sm"
            />
            <Button onClick={handleSearch}>
              Search
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-500">
              Currently viewing: <span className="font-mono text-slate-400">{formatAddress(walletAddress)}</span>
            </p>
            {balanceLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading balance...</span>
              </div>
            ) : balance ? (
              <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-1.5">
                <Wallet className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-slate-100">
                  {balance.balance_eth.toFixed(4)} ETH
                </span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {history?.summary?.total_transactions || 0}
              </p>
              <p className="text-sm text-slate-400">Total Transactions</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <Ban className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {history?.summary?.total_blocked || 0}
              </p>
              <p className="text-sm text-slate-400">Blocked Transfers</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {history?.summary?.total_warnings || 0}
              </p>
              <p className="text-sm text-slate-400">Warnings Received</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/50 bg-slate-800/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {3 - (history?.summary?.warning_count || 0)}/3
              </p>
              <p className="text-sm text-slate-400">Warnings Left</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different history views */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
          <TabsTrigger value="transactions" className="data-[state=active]:bg-slate-700">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="blocked" className="data-[state=active]:bg-slate-700">
            <Ban className="h-4 w-4 mr-2" />
            Blocked
          </TabsTrigger>
          <TabsTrigger value="warnings" className="data-[state=active]:bg-slate-700">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Warnings
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card className="border-slate-700/50 bg-slate-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <History className="h-5 w-5 text-cyan-400" />
                Transaction History
              </CardTitle>
              <CardDescription className="text-slate-400">
                All successful transactions for this wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : history?.successful_transactions?.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.successful_transactions?.map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2.5 rounded-lg ${tx.direction === "sent"
                            ? "bg-red-500/10 border border-red-500/20"
                            : "bg-emerald-500/10 border border-emerald-500/20"
                            }`}
                        >
                          {tx.direction === "sent" ? (
                            <ArrowUpRight className="h-5 w-5 text-red-400" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {tx.direction === "sent" ? "Sent" : "Received"}
                          </p>
                          <p className="text-sm text-slate-400 font-mono">
                            {tx.direction === "sent"
                              ? `To: ${formatAddress(tx.to_address)}`
                              : `From: ${formatAddress(tx.from_address)}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${tx.direction === "sent" ? "text-red-400" : "text-emerald-400"
                            }`}
                        >
                          {tx.direction === "sent" ? "-" : "+"}
                          {tx.value_eth?.toFixed(4) || "0.0000"} ETH
                        </p>
                        <p className="text-xs text-slate-500">
                          {tx.timestamp ? formatDate(tx.timestamp) : "Pending"}
                        </p>
                      </div>
                      {tx.is_flagged && (
                        <Badge variant="destructive" className="ml-3">
                          Flagged
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blocked Transfers Tab */}
        <TabsContent value="blocked">
          <Card className="border-slate-700/50 bg-slate-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Ban className="h-5 w-5 text-red-400" />
                Blocked Transfers
              </CardTitle>
              <CardDescription className="text-slate-400">
                Transfers that were blocked by the AI protection system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : history?.blocked_transfers?.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No blocked transfers</p>
                  <p className="text-sm mt-1">Your transfers are safe!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Time</TableHead>
                      <TableHead className="text-slate-300">To Address</TableHead>
                      <TableHead className="text-slate-300">Amount</TableHead>
                      <TableHead className="text-slate-300">Risk Score</TableHead>
                      <TableHead className="text-slate-300">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.blocked_transfers?.map((transfer: any) => (
                      <TableRow key={transfer.id} className="border-slate-700/50">
                        <TableCell className="text-slate-300">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-500" />
                            <span className="text-sm">
                              {formatDate(transfer.blocked_at)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-slate-300">
                          {formatAddress(transfer.receiver_address)}
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {transfer.amount_eth?.toFixed(4) || "0.0000"} ETH
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${getRiskColor(transfer.risk_score)}`}>
                            {transfer.risk_score?.toFixed(0) || 0}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {transfer.block_reason?.replace(/_/g, " ") || "High Risk"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warnings Tab */}
        <TabsContent value="warnings">
          <Card className="border-slate-700/50 bg-slate-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Risk Warnings
              </CardTitle>
              <CardDescription className="text-slate-400">
                Warnings received when attempting risky transfers (3 strikes = suspension)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : history?.warnings?.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400 opacity-50" />
                  <p>No warnings on record</p>
                  <p className="text-sm mt-1">You have a clean record!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history?.warnings?.map((warning: any) => (
                    <div
                      key={warning.id}
                      className="p-4 rounded-lg bg-slate-800/50 border border-amber-500/20"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10">
                            <AlertTriangle className="h-5 w-5 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              Warning #{warning.warning_number}: {warning.warning_type?.replace(/_/g, " ")}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              Attempted transfer to:{" "}
                              <span className="font-mono">{formatAddress(warning.target_address)}</span>
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                              Risk Score: <span className={getRiskColor(warning.risk_score)}>{warning.risk_score}%</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={warning.user_action === "cancelled" ? "outline" : "destructive"}
                            className="text-xs"
                          >
                            {warning.user_action === "cancelled" ? "Cancelled" : "Ignored"}
                          </Badge>
                          <p className="text-xs text-slate-500 mt-2">
                            {formatDate(warning.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

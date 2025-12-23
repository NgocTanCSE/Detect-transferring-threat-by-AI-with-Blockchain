"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wallet,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Copy,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchWalletBalance,
  fetchWalletTransactions,
  sendProtectedTransfer,
  type WalletBalance,
  type Transaction,
  type TransferResponse,
} from "@/lib/api";
import { formatAddress, formatEth, formatDate } from "@/lib/utils";

// Demo wallet address (in real app, this would come from auth context)
const DEMO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD08";

export default function UserExchange() {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Dialog states
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transferResponse, setTransferResponse] = useState<TransferResponse | null>(
    null
  );
  const [currentWarnings, setCurrentWarnings] = useState(0);

  // Fetch wallet balance
  const { data: balance, isLoading: balanceLoading } = useQuery<WalletBalance>({
    queryKey: ["walletBalance", DEMO_WALLET],
    queryFn: () => fetchWalletBalance(DEMO_WALLET),
    refetchInterval: 30000,
  });

  // Fetch transactions
  const { data: transactions, isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["walletTransactions", DEMO_WALLET],
    queryFn: () => fetchWalletTransactions(DEMO_WALLET, 10),
    refetchInterval: 30000,
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: (params: { confirmRisk: boolean }) =>
      sendProtectedTransfer(
        DEMO_WALLET,
        toAddress,
        parseFloat(amount),
        params.confirmRisk
      ),
    onSuccess: (response) => {
      setTransferResponse(response);

      if (response.status === "warning") {
        // Show warning dialog
        setCurrentWarnings(response.current_warnings || 0);
        setShowWarningDialog(true);
      } else if (response.status === "blocked") {
        // Show blocked dialog (risk > 80 or blacklisted)
        setShowBlockedDialog(true);
      } else if (response.status === "success") {
        // Show success dialog
        setShowSuccessDialog(true);
        setToAddress("");
        setAmount("");
      }
    },
    onError: (error) => {
      console.error("Transfer failed:", error);
    },
  });

  const handleSend = () => {
    if (!toAddress || !amount || parseFloat(amount) <= 0) return;
    transferMutation.mutate({ confirmRisk: false });
  };

  const handleConfirmRisk = () => {
    setShowWarningDialog(false);
    transferMutation.mutate({ confirmRisk: true });
  };

  const handleCancelTransfer = () => {
    setShowWarningDialog(false);
    setTransferResponse(null);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(DEMO_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-cyber-bg-dark to-cyber-bg-darker p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Wallet Card - Banking Style */}
        <Card className="border-cyber-border bg-gradient-to-br from-cyber-bg-card to-cyber-bg-elevated overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyber-neon-cyan/5 rounded-full blur-3xl" />
          <CardContent className="p-8 relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-cyber-text-muted text-sm mb-1">
                  Available Balance
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-cyber-text-primary">
                    {balanceLoading ? "..." : balance?.balance_eth.toFixed(4) || "0"}
                  </span>
                  <span className="text-2xl text-cyber-neon-cyan">ETH</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-cyber-bg-darker rounded-lg px-3 py-2 border border-cyber-border">
                    <Wallet className="h-4 w-4 text-cyber-neon-cyan" />
                    <span className="font-mono text-sm text-cyber-text-secondary">
                      {formatAddress(DEMO_WALLET, 8)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyAddress}
                    className="h-9 w-9"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-cyber-neon-green" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-cyber-neon-green/10 border border-cyber-neon-green/30 rounded-full px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-cyber-neon-green" />
                <span className="text-sm text-cyber-neon-green font-medium">
                  Protected
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Send Form */}
        <Card className="border-cyber-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-cyber-neon-cyan" />
              Send ETH
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Security Notice */}
            <div className="bg-cyber-neon-cyan/5 border border-cyber-neon-cyan/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-cyber-neon-cyan shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-cyber-text-primary font-medium">
                    AI Protection Active
                  </p>
                  <p className="text-xs text-cyber-text-muted mt-1">
                    All transfers are checked against our AI fraud detection system.
                    Transfers to high-risk wallets (score &gt; 80) will be blocked
                    automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Recipient Address */}
            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient Address</Label>
              <Input
                id="toAddress"
                placeholder="0x..."
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (ETH)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyber-text-muted">
                  ETH
                </span>
              </div>
              <p className="text-xs text-cyber-text-muted">
                Available: {balance?.balance_eth.toFixed(4) || "0"} ETH
              </p>
            </div>

            {/* Send Button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handleSend}
              disabled={
                transferMutation.isPending ||
                !toAddress ||
                !amount ||
                parseFloat(amount) <= 0
              }
            >
              {transferMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyber-bg-dark" />
                  Checking...
                </div>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Send ETH
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-cyber-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyber-text-muted" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyber-neon-cyan" />
              </div>
            ) : transactions?.length === 0 ? (
              <div className="text-center py-8 text-cyber-text-muted">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions?.slice(0, 5).map((tx) => {
                  const isSent =
                    tx.from_address.toLowerCase() === DEMO_WALLET.toLowerCase();
                  return (
                    <div
                      key={tx.tx_hash}
                      className="flex items-center justify-between p-4 rounded-lg bg-cyber-bg-elevated border border-cyber-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isSent
                              ? "bg-cyber-neon-red/10 border-cyber-neon-red/30"
                              : "bg-cyber-neon-green/10 border-cyber-neon-green/30"
                            } border`}
                        >
                          {isSent ? (
                            <ArrowUpRight className="h-5 w-5 text-cyber-neon-red" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5 text-cyber-neon-green" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-cyber-text-primary">
                            {isSent ? "Sent" : "Received"}
                          </p>
                          <p className="text-sm text-cyber-text-muted font-mono">
                            {isSent
                              ? `To: ${formatAddress(tx.to_address)}`
                              : `From: ${formatAddress(tx.from_address)}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${isSent ? "text-cyber-neon-red" : "text-cyber-neon-green"
                            }`}
                        >
                          {isSent ? "-" : "+"}
                          {formatEth(tx.value_wei)} ETH
                        </p>
                        <p className="text-xs text-cyber-text-muted">
                          {formatDate(tx.timestamp)}
                        </p>
                      </div>
                      {tx.is_flagged && (
                        <Badge variant="destructive" className="ml-2">
                          Flagged
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warning Dialog - Risk 50-80% */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyber-neon-orange">
              <AlertTriangle className="h-6 w-6" />
              Risk Warning
            </DialogTitle>
            <DialogDescription>
              This wallet has been flagged by our AI security system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Risk Score Display */}
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#1a1a2e"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#ff6600"
                    strokeWidth="12"
                    strokeDasharray={`${((transferResponse?.receiver_risk || 0) / 100) * 352
                      } 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-cyber-neon-orange">
                    {transferResponse?.receiver_risk?.toFixed(0) || 0}
                  </span>
                  <span className="text-xs text-cyber-text-muted">Risk Score</span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-cyber-neon-orange/10 border border-cyber-neon-orange/30 rounded-lg p-4">
              <p className="text-sm text-cyber-text-primary">
                {transferResponse?.message}
              </p>
            </div>

            {/* Warning Count */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-cyber-text-muted">Warnings:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${i <= currentWarnings
                        ? "bg-cyber-neon-red"
                        : "bg-cyber-border"
                      }`}
                  />
                ))}
              </div>
              <span className="text-sm text-cyber-neon-orange font-medium">
                {transferResponse?.warning_text}
              </span>
            </div>

            {currentWarnings >= 2 && (
              <div className="bg-cyber-neon-red/10 border border-cyber-neon-red/30 rounded-lg p-3">
                <p className="text-sm text-cyber-neon-red flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  Final warning! Your account will be suspended if you proceed.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelTransfer}>
              Cancel Transfer
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRisk}
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? "Processing..." : "Proceed Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocked Dialog - Risk > 80% or Blacklisted */}
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyber-neon-red">
              <AlertOctagon className="h-6 w-6" />
              Transfer Blocked
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Blocked Icon */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-cyber-neon-red/20 flex items-center justify-center animate-pulse">
                  <XCircle className="h-12 w-12 text-cyber-neon-red" />
                </div>
              </div>
            </div>

            {/* Block Reason */}
            <div className="bg-cyber-neon-red/10 border border-cyber-neon-red/30 rounded-lg p-4">
              <p className="text-sm text-cyber-text-primary text-center">
                {transferResponse?.message ||
                  "This transfer has been blocked due to high risk."}
              </p>
            </div>

            <div className="text-center">
              <p className="text-cyber-text-muted text-sm">
                The recipient wallet has a critical risk score and has been
                identified as potentially fraudulent.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                setShowBlockedDialog(false);
                setToAddress("");
                setAmount("");
              }}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyber-neon-green">
              <CheckCircle2 className="h-6 w-6" />
              Transfer Successful
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Success Icon */}
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-cyber-neon-green/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-cyber-neon-green" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-cyber-text-primary">
                Your transfer has been processed successfully.
              </p>
              {transferResponse?.tx_hash && (
                <p className="text-sm text-cyber-text-muted mt-2 font-mono">
                  TX: {formatAddress(transferResponse.tx_hash, 10)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full"
              variant="neon-green"
              onClick={() => setShowSuccessDialog(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

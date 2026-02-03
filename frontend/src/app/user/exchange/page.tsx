"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  Loader2,
  LogOut,
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
import { useAuth } from "@/lib/auth-context";

export default function UserExchange() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Auto-fill sender wallet from authenticated user
  useEffect(() => {
    if (user?.wallet_address && !fromWalletId) {
      setFromWalletId(user.wallet_address);
    }
  }, [user, fromWalletId]);

  // Redirect to login if not authenticated (after loading)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Sender wallet balance state
  const [senderBalance, setSenderBalance] = useState<WalletBalance | null>(null);
  const [senderBalanceLoading, setSenderBalanceLoading] = useState(false);
  const [senderBalanceError, setSenderBalanceError] = useState<string | null>(null);

  // Sender transaction history state
  const [senderTransactions, setSenderTransactions] = useState<Transaction[]>([]);
  const [senderTxLoading, setSenderTxLoading] = useState(false);

  // Receiver risk assessment state (only risk, not balance)
  const [receiverRisk, setReceiverRisk] = useState<{ risk_score: number; risk_level: string } | null>(null);
  const [receiverRiskLoading, setReceiverRiskLoading] = useState(false);
  const [receiverRiskError, setReceiverRiskError] = useState<string | null>(null);

  // Dialog states
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [transferResponse, setTransferResponse] = useState<TransferResponse | null>(
    null
  );
  const [currentWarnings, setCurrentWarnings] = useState(user?.warning_count || 0);

  // Fetch sender balance and transaction history when address changes
  const fetchSenderBalanceHandler = useCallback(async (address: string) => {
    if (!address || address.length < 42 || !address.startsWith("0x")) {
      setSenderBalance(null);
      setSenderBalanceError(null);
      setSenderTransactions([]);
      return;
    }

    setSenderBalanceLoading(true);
    setSenderBalanceError(null);
    setSenderTxLoading(true);

    try {
      // Fetch balance and transactions in parallel
      const [balance, txData] = await Promise.all([
        fetchWalletBalance(address),
        fetchWalletTransactions(address, 10)
      ]);
      setSenderBalance(balance);
      // API returns {transactions: [...]} so extract the array
      const txResponse = txData as unknown as { transactions: Transaction[] } | Transaction[];
      const transactions = Array.isArray(txResponse) ? txResponse : (txResponse?.transactions || []);
      setSenderTransactions(transactions);
    } catch (error) {
      setSenderBalanceError("Không thể lấy thông tin ví");
      setSenderBalance(null);
      setSenderTransactions([]);
    } finally {
      setSenderBalanceLoading(false);
      setSenderTxLoading(false);
    }
  }, []);

  // Watch fromWalletId changes with debounce (assuming it's an address)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (fromWalletId && fromWalletId.startsWith("0x")) {
        fetchSenderBalanceHandler(fromWalletId);
      } else {
        setSenderBalance(null);
        setSenderBalanceError(null);
        setSenderTransactions([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fromWalletId, fetchSenderBalanceHandler]);

  // Fetch receiver risk assessment when toAddress changes
  const fetchReceiverRisk = useCallback(async (address: string) => {
    if (!address || address.length < 42 || !address.startsWith("0x")) {
      setReceiverRisk(null);
      setReceiverRiskError(null);
      return;
    }

    setReceiverRiskLoading(true);
    setReceiverRiskError(null);

    try {
      const data = await fetchWalletBalance(address);
      const riskLevel = data.risk_score >= 80 ? 'CRITICAL' :
        data.risk_score >= 60 ? 'HIGH' :
          data.risk_score >= 40 ? 'MEDIUM' : 'LOW';
      setReceiverRisk({ risk_score: data.risk_score, risk_level: riskLevel });
    } catch (error) {
      setReceiverRiskError("Không thể kiểm tra địa chỉ");
      setReceiverRisk(null);
    } finally {
      setReceiverRiskLoading(false);
    }
  }, []);

  // Watch toAddress changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (toAddress && toAddress.startsWith("0x")) {
        fetchReceiverRisk(toAddress);
      } else {
        setReceiverRisk(null);
        setReceiverRiskError(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [toAddress, fetchReceiverRisk]);

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
        fromWalletId,
        toWalletId,
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
        // Refresh sender balance after successful transfer
        if (fromWalletId) {
          fetchSenderBalanceHandler(fromWalletId);
        }
        setToWalletId("");
        setToAddress("");
        setAmount("");
        setReceiverRisk(null);
        // Keep fromWalletId to show updated balance
      }
    },
    onError: (error) => {
      console.error("Transfer failed:", error);
    },
  });

  const handleSend = () => {
    if (!fromWalletId || !toWalletId || !toAddress || !amount || parseFloat(amount) <= 0) return;
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
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Send Form */}
        <Card className="glass-card glass-card-hover animate-slide-up gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-cyan-400" />
              Send ETH
              <div className="ml-auto flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">
                  AI Protected
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Security Notice */}
            <div className="bg-cyan-500/5 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-100 font-medium">
                    AI Protection Active
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    All transfers are checked against our AI fraud detection system.
                    Transfers to high-risk wallets (score &gt; 80) will be blocked
                    automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* From Wallet ID */}
            <div className="space-y-2">
              <Label htmlFor="fromWalletId">From Wallet Address</Label>
              <Input
                id="fromWalletId"
                placeholder="0x..."
                value={fromWalletId}
                onChange={(e) => setFromWalletId(e.target.value)}
                className="font-mono bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              {/* Sender Balance Info */}
              {senderBalanceLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang kiểm tra ví...</span>
                </div>
              )}
              {senderBalanceError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <XCircle className="h-4 w-4" />
                  <span>{senderBalanceError}</span>
                </div>
              )}
              {senderBalance && !senderBalanceLoading && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-cyan-400" />
                      <span className="text-sm text-slate-400">Số dư khả dụng:</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-slate-100">
                        {senderBalance.balance_eth.toFixed(4)}
                      </span>
                      <span className="text-sm text-cyan-400">ETH</span>
                    </div>
                  </div>

                  {/* Transaction History removed from here */}
                </div>
              )}
            </div>

            {/* To Wallet ID */}
            <div className="space-y-2">
              <Input
                id="toWalletId"
                placeholder="0x... hoặc Wallet ID"
                value={toWalletId}
                onChange={(e) => {
                  const value = e.target.value;
                  setToWalletId(value);
                  // Auto-sync to recipient address if it looks like an Ethereum address
                  if (value.startsWith("0x") && value.length >= 10) {
                    setToAddress(value);
                  }
                }}
                className="font-mono bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">
                Nhập địa chỉ ví Ethereum (0x...) hoặc Wallet ID
              </p>
            </div>

            {/* Recipient Address - Hidden input, synced from toWalletId */}
            <input type="hidden" value={toAddress} />

            {/* Receiver Risk Assessment - Shown below To Wallet ID */}
            {receiverRiskLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm -mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang kiểm tra độ an toàn...</span>
              </div>
            )}
            {receiverRiskError && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm -mt-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{receiverRiskError}</span>
              </div>
            )}
            {receiverRisk && !receiverRiskLoading && (
              <div className={`border rounded-lg p-3 -mt-2 ${receiverRisk.risk_score >= 80
                ? 'bg-red-500/10 border-red-500/30'
                : receiverRisk.risk_score >= 60
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : receiverRisk.risk_score >= 40
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-green-500/10 border-green-500/30'
                }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {receiverRisk.risk_score >= 60 ? (
                      <ShieldAlert className={`h-5 w-5 ${receiverRisk.risk_score >= 80 ? 'text-red-400' : 'text-orange-400'
                        }`} />
                    ) : (
                      <ShieldCheck className={`h-5 w-5 ${receiverRisk.risk_score >= 40 ? 'text-yellow-400' : 'text-green-400'
                        }`} />
                    )}
                    <span className="text-sm font-medium text-slate-100">
                      {receiverRisk.risk_score >= 80
                        ? '⚠️ Địa chỉ nguy hiểm!'
                        : receiverRisk.risk_score >= 60
                          ? '⚠️ Địa chỉ rủi ro cao'
                          : receiverRisk.risk_score >= 40
                            ? '⚠️ Cần cẩn thận'
                            : '✅ Địa chỉ an toàn'}
                    </span>
                  </div>
                  <Badge variant="outline" className={`${receiverRisk.risk_score >= 80
                    ? 'border-red-500 text-red-400'
                    : receiverRisk.risk_score >= 60
                      ? 'border-orange-500 text-orange-400'
                      : receiverRisk.risk_score >= 40
                        ? 'border-yellow-500 text-yellow-400'
                        : 'border-green-500 text-green-400'
                    }`}>
                    Risk: {receiverRisk.risk_score.toFixed(0)}%
                  </Badge>
                </div>
                {receiverRisk.risk_score >= 60 && (
                  <p className="text-xs text-slate-400 mt-2">
                    {receiverRisk.risk_score >= 80
                      ? 'Giao dịch đến địa chỉ này sẽ bị chặn tự động!'
                      : 'Bạn sẽ nhận được cảnh báo nếu tiếp tục giao dịch.'}
                  </p>
                )}
              </div>
            )}

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
                  className="pr-16 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ETH
                </span>
              </div>
              {senderBalance && (
                <p className="text-xs text-slate-400">
                  Khả dụng: {senderBalance.balance_eth.toFixed(4)} ETH
                </p>
              )}
            </div>

            {/* Send Button */}
            <Button
              className="w-full h-12 text-lg"
              onClick={handleSend}
              disabled={
                transferMutation.isPending ||
                !fromWalletId ||
                !toWalletId ||
                !toAddress ||
                !amount ||
                parseFloat(amount) <= 0
              }
            >
              {transferMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900" />
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
        <Card className="glass-card glass-card-hover animate-slide-up stagger-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(fromWalletId ? senderTxLoading : txLoading) ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400" />
              </div>
            ) : (fromWalletId ? senderTransactions : transactions)?.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(fromWalletId ? senderTransactions : transactions)?.slice(0, 5).map((tx: any) => {
                  const currentWallet = fromWalletId || DEMO_WALLET;
                  const isSent =
                    tx.from_address.toLowerCase() === currentWallet.toLowerCase();
                  return (
                    <div
                      key={tx.tx_hash}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-800 border border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${isSent
                            ? "bg-red-500/10 border-red-500/30"
                            : "bg-emerald-500/10 border-emerald-500/30"
                            } border`}
                        >
                          {isSent ? (
                            <ArrowUpRight className="h-5 w-5 text-red-400" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-100">
                            {isSent ? "Sent" : "Received"}
                          </p>
                          <p className="text-sm text-slate-400 font-mono">
                            {isSent
                              ? `To: ${formatAddress(tx.to_address)}`
                              : `From: ${formatAddress(tx.from_address)}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${isSent ? "text-red-400" : "text-emerald-400"
                            }`}
                        >
                          {isSent ? "-" : "+"}
                          {formatEth(tx.value_wei)} ETH
                        </p>
                        <p className="text-xs text-slate-400">
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
            <DialogTitle className="flex items-center gap-2 text-orange-400">
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
                    stroke="#334155"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="12"
                    strokeDasharray={`${((transferResponse?.receiver_risk || 0) / 100) * 352
                      } 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-orange-400">
                    {transferResponse?.receiver_risk?.toFixed(0) || 0}
                  </span>
                  <span className="text-xs text-slate-400">Risk Score</span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <p className="text-sm text-slate-100">
                {transferResponse?.message}
              </p>
            </div>

            {/* Warning Count */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-slate-400">Warnings:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${i <= currentWarnings
                      ? "bg-red-400"
                      : "bg-slate-600"
                      }`}
                  />
                ))}
              </div>
              <span className="text-sm text-orange-400 font-medium">
                {transferResponse?.warning_text}
              </span>
            </div>

            {currentWarnings >= 2 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 flex items-center gap-2">
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
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertOctagon className="h-6 w-6" />
              Transfer Blocked
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Blocked Icon */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                  <XCircle className="h-12 w-12 text-red-400" />
                </div>
              </div>
            </div>

            {/* Block Reason */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-slate-100 text-center">
                {transferResponse?.message ||
                  "This transfer has been blocked due to high risk."}
              </p>
            </div>

            <div className="text-center">
              <p className="text-slate-400 text-sm">
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
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              Transfer Successful
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Success Icon */}
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-100">
                Your transfer has been processed successfully.
              </p>
              {transferResponse?.tx_hash && (
                <p className="text-sm text-slate-400 mt-2 font-mono">
                  TX: {formatAddress(transferResponse.tx_hash, 10)}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowSuccessDialog(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}

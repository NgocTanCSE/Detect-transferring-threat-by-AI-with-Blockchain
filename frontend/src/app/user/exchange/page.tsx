"use client";

import { useState, useEffect, useCallback } from "react";
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
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Loader2,
  LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [selectedAsset, setSelectedAsset] = useState("ETH");

  // State
  const [senderBalance, setSenderBalance] = useState<WalletBalance | null>(null);
  const [senderTransactions, setSenderTransactions] = useState<Transaction[]>([]);
  const [receiverRisk, setReceiverRisk] = useState<{ risk_score: number; risk_level: string } | null>(null);
  const [loading, setLoading] = useState({ balance: false, tx: false, risk: false, transfer: false });
  const [dialogs, setDialogs] = useState({ warning: false, blocked: false, success: false });
  const [transferResponse, setTransferResponse] = useState<TransferResponse | null>(null);

  useEffect(() => {
    if (user?.wallet_address) setFromWalletId(user.wallet_address);
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [user, authLoading, isAuthenticated, router]);

  const refreshData = useCallback(async () => {
    if (!fromWalletId) return;
    setLoading(prev => ({ ...prev, balance: true, tx: true }));
    try {
      const [bal, txs] = await Promise.all([
        fetchWalletBalance(fromWalletId, selectedChain),
        fetchWalletTransactions(fromWalletId, 10)
      ]);
      setSenderBalance(bal);
      setSenderTransactions(txs);
    } finally {
      setLoading(prev => ({ ...prev, balance: false, tx: false }));
    }
  }, [fromWalletId, selectedChain]);

  useEffect(() => { refreshData(); }, [refreshData]);

  // Real-time risk check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (toAddress.length >= 42) {
        setLoading(prev => ({ ...prev, risk: true }));
        try {
          // Use common API for risk check
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/analyze/${toAddress}`);
          const data = await res.json();
          setReceiverRisk(data.payload || data);
        } catch {
          setReceiverRisk(null);
        } finally {
          setLoading(prev => ({ ...prev, risk: false }));
        }
      } else {
        setReceiverRisk(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [toAddress]);

  const handleTransfer = async (force = false) => {
    setLoading(prev => ({ ...prev, transfer: true }));
    try {
      const res = await sendProtectedTransfer({
        sender: fromWalletId,
        receiver: toAddress,
        amount,
        chain: selectedChain,
        asset: selectedAsset,
        force_proceed: force
      });
      setTransferResponse(res);
      if (res.status === "blocked" || res.blocked) setDialogs(d => ({ ...d, blocked: true }));
      else if (res.status === "warning") setDialogs(d => ({ ...d, warning: true }));
      else {
        setDialogs(d => ({ ...d, success: true }));
        refreshData();
      }
    } catch (err: any) {
      alert(err.message || "Transfer failed");
    } finally {
      setLoading(prev => ({ ...prev, transfer: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-100">
      <header className="border-b border-slate-800/60 bg-[#08080a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.3)]">
              <ShieldCheck className="h-6 w-6 text-slate-950" />
            </div>
            <span className="text-xl font-bold">Sentinel <span className="text-teal-400">Wallet</span></span>
          </div>
          <Button variant="ghost" onClick={() => { logout(); router.push("/user"); }} className="text-slate-400 hover:text-white">
            <LogOut className="h-5 w-5 mr-2" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Transfer Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Send Assets</h1>
            <div className="flex gap-2">
              <select value={selectedChain} onChange={e => setSelectedChain(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs">
                <option value="ethereum">Ethereum</option>
                <option value="bsc">BSC Network</option>
              </select>
              <select value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 text-xs">
                {selectedChain === "ethereum" ? <><option>ETH</option><option>USDT</option></> : <><option>BNB</option><option>USDT</option></>}
              </select>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-[32px] p-8 space-y-6 backdrop-blur-md">
            <div className="space-y-2">
              <Label className="text-slate-400">Recipient Address</Label>
              <div className="relative">
                <Input placeholder="0x..." value={toAddress} onChange={e => setToAddress(e.target.value)} className="h-14 bg-slate-950 border-slate-800 rounded-2xl font-mono" />
                {loading.risk && <Loader2 className="absolute right-4 top-4 h-6 w-6 animate-spin text-teal-500" />}
              </div>
              {receiverRisk && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${receiverRisk.risk_score > 80 ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-teal-500/10 border-teal-500/30 text-teal-400"}`}>
                  <AlertTriangle className="h-4 w-4" /> AI Risk: {receiverRisk.risk_score}% ({receiverRisk.risk_level})
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label className="text-slate-400">Amount</Label>
                <span className="text-slate-500">Balance: {senderBalance?.balance_eth.toFixed(4)} {selectedAsset}</span>
              </div>
              <div className="relative">
                <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="h-14 bg-slate-950 border-slate-800 rounded-2xl text-2xl font-bold" />
                <span className="absolute right-6 top-4 font-bold text-slate-500">{selectedAsset}</span>
              </div>
            </div>

            <Button onClick={() => handleTransfer()} disabled={loading.transfer || !toAddress || !amount} className="h-14 w-full rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-lg font-black shadow-[0_10px_40px_rgba(20,184,166,0.3)] transition-all active:scale-[0.98]">
              {loading.transfer ? <Loader2 className="h-6 w-6 animate-spin" /> : <><Send className="mr-2 h-5 w-5" /> Confirm Transfer</>}
            </Button>
          </div>
        </div>

        {/* Right: Portfolio & History */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-slate-900/40 border-slate-800 rounded-[32px] overflow-hidden">
            <CardHeader className="bg-slate-950/40 border-b border-slate-800/60 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-teal-400" /> Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <div className="inline-block p-6 rounded-full bg-teal-500/10 ring-1 ring-teal-500/20 mb-4">
                <span className="text-4xl font-black">{senderBalance?.balance_eth.toFixed(2)}</span>
              </div>
              <p className="text-xs font-bold text-teal-500 tracking-[0.2em] uppercase">Current {selectedAsset} Holdings</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/40 border-slate-800 rounded-[32px] overflow-hidden">
            <CardHeader className="bg-slate-950/40 border-b border-slate-800/60 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2"><Clock className="h-5 w-5 text-slate-500" /> Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto">
              {senderTransactions.map(tx => (
                <div key={tx.id} className="p-4 border-b border-slate-800/40 hover:bg-slate-800/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {tx.from_address.toLowerCase() === fromWalletId.toLowerCase() ? <ArrowUpRight className="text-slate-500 h-5 w-5" /> : <ArrowDownLeft className="text-teal-500 h-5 w-5" />}
                    <div>
                      <p className="text-xs font-mono text-slate-300">{formatAddress(tx.from_address.toLowerCase() === fromWalletId.toLowerCase() ? tx.to_address : tx.from_address)}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(tx.timestamp)}</p>
                    </div>
                  </div>
                  <span className={`font-bold ${tx.from_address.toLowerCase() === fromWalletId.toLowerCase() ? "text-slate-100" : "text-teal-400"}`}>
                    {tx.from_address.toLowerCase() === fromWalletId.toLowerCase() ? "-" : "+"}{formatEth(tx.value || tx.value_wei)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Dialogs */}
      <Dialog open={dialogs.blocked} onOpenChange={v => setDialogs(d => ({ ...d, blocked: v }))}>
        <DialogContent className="bg-slate-950 border-red-900/50 rounded-[32px]">
          <DialogHeader className="items-center text-center">
            <div className="h-20 w-24 rounded-full bg-red-500/10 flex items-center justify-center mb-4"><AlertOctagon className="h-12 w-12 text-red-500" /></div>
            <DialogTitle className="text-2xl font-black text-red-500 uppercase">Transfer Blocked</DialogTitle>
            <DialogDescription className="text-slate-400">{transferResponse?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setDialogs(d => ({ ...d, blocked: false }))} className="w-full h-12 rounded-xl bg-red-500 hover:bg-red-400 text-white">Understood</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogs.success} onOpenChange={v => setDialogs(d => ({ ...d, success: v }))}>
        <DialogContent className="bg-slate-950 border-teal-900/50 rounded-[32px]">
          <DialogHeader className="items-center text-center">
            <div className="h-20 w-24 rounded-full bg-teal-500/10 flex items-center justify-center mb-4"><CheckCircle2 className="h-12 w-12 text-teal-500" /></div>
            <DialogTitle className="text-2xl font-black text-teal-500 uppercase">Success</DialogTitle>
            <DialogDescription className="text-slate-400">Funds have been sent securely.</DialogDescription>
          </DialogHeader>
          <DialogFooter><Button onClick={() => setDialogs(d => ({ ...d, success: false }))} className="w-full h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold">Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Warning Dialog */}
      <Dialog open={dialogs.warning} onOpenChange={v => setDialogs(d => ({ ...d, warning: v }))}>
        <DialogContent className="bg-slate-950 border-amber-900/50 rounded-[32px]">
          <DialogHeader className="items-center text-center">
            <div className="h-20 w-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-4"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>
            <DialogTitle className="text-2xl font-black text-amber-500 uppercase">Risk Warning</DialogTitle>
            <DialogDescription className="text-slate-400">{transferResponse?.message}</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-center text-amber-500/80 font-medium">{transferResponse?.warning_text}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogs(d => ({ ...d, warning: false }))} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={() => handleTransfer(true)} className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold">Proceed Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

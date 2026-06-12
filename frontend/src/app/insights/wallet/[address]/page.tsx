"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  Link2, 
  Wallet, 
  ChevronRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Brain, 
  ShieldCheck, 
  AlertTriangle,
  Loader2,
  Database,
  Search,
  Globe
} from "lucide-react";
import { fetchWalletConnections, fetchWalletStats, fetchWalletTransactionHistory, formatEth, analyzeAddress } from "@/lib/api";
import { authFetch } from "@/lib/auth-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WalletNetworkGraph from "@/components/wallet-network-graph";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell
} from "recharts";

function shortAddress(address: string): string {
  if (!address) return "-";
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export default function WalletInsightPage() {
  return (
    <Suspense fallback={<InsightFallback title="Wallet Drill-down" />}>
      <WalletInsightContent />
    </Suspense>
  );
}

function WalletInsightContent() {
  const params = useParams<{ address: string }>();
  const searchParams = useSearchParams();
  const address = decodeURIComponent(params.address || "").toLowerCase();
  
  const chain = searchParams.get("chain") || "ethereum";
  const role = searchParams.get("role") || "system_admin";
  const feature = searchParams.get("feature") || "0";
  const router = useRouter();
  
  const contextQuery = `?${new URLSearchParams({ role, feature, chain }).toString()}`;
  
  const [alchemyData, setAlchemyData] = useState<any>(null);
  const [alchemyLoading, setAlchemyLoading] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["walletInsightStats", address, chain],
    queryFn: () => fetchWalletStats(address),
    enabled: !!address,
  });

  const { data: txs, isLoading: txLoading } = useQuery({
    queryKey: ["walletInsightTx", address, chain],
    queryFn: () => fetchWalletTransactionHistory(address, 50),
    enabled: !!address,
  });

  const { data: connections, isLoading: connLoading } = useQuery({
    queryKey: ["walletInsightConnections", address, chain],
    queryFn: () => fetchWalletConnections(address),
    enabled: !!address,
  });

  const { data: aiAnalysis, isLoading: aiLoading } = useQuery({
    queryKey: ["walletAIAnalysis", address, chain],
    queryFn: () => analyzeAddress(address),
    enabled: !!address,
  });

  async function fetchAlchemyData() {
    if (alchemyData) return;
    setAlchemyLoading(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}/diagnostics/alchemy/${address}`);
      if (!res.ok) throw new Error("Failed to fetch alchemy data");
      setAlchemyData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setAlchemyLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-100 p-6 selection:bg-teal-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Breadcrumbs & Back */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href={`/admin/dashboard${contextQuery}`} className="hover:text-teal-400 transition-colors flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Sentinel Dashboard
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-slate-300 font-medium">Wallet Intelligence</span>
          </div>
          <Link href={`/admin/dashboard${contextQuery}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-all">
            <ArrowLeft className="h-4 w-4" /> Back to Context
          </Link>
        </div>

        {/* Profile Header */}
        <header className="relative overflow-hidden rounded-[32px] border border-slate-800/70 bg-slate-950/60 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-amber-500/5 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-400 via-slate-100 to-amber-300 shadow-[0_0_50px_rgba(20,184,166,0.15)]">
                <Wallet className="h-10 w-10 text-black" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-white font-mono">{address}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Badge className="bg-teal-400/10 text-teal-400 border-teal-400/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">Active Identity</Badge>
                  <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-xs text-slate-400">
                    <Globe className="h-3.5 w-3.5" /> {chain.toUpperCase()} NETWORK
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8 lg:border-l lg:border-slate-800 lg:pl-8">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">AI Risk Score</p>
                <div className={`text-5xl font-black tracking-tighter ${
                  (aiAnalysis?.risk_score ?? 0) > 80 ? "text-red-500" : (aiAnalysis?.risk_score ?? 0) > 50 ? "text-amber-500" : "text-teal-400"
                }`}>
                  {aiAnalysis?.risk_score?.toFixed(0) ?? stats?.wallet_info?.risk_score?.toFixed(0) ?? "0"}%
                </div>
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Status</p>
                <Badge variant="outline" className="border-slate-700 text-slate-300 px-4 py-1.5 rounded-xl font-bold">
                  {stats?.account_status?.toUpperCase() || "UNKNOWN"}
                </Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Top Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Balance" value={statsLoading ? "..." : formatEth(stats?.eth_balance ?? 0)} tone="teal" />
          <MetricCard title="Total Volume" value={statsLoading ? "..." : formatEth((stats?.eth_sent ?? 0) + (stats?.eth_received ?? 0))} tone="slate" />
          <MetricCard title="Inbound Tx" value={statsLoading ? "..." : String(stats?.total_transactions ?? 0)} tone="slate" />
          <MetricCard title="Detections" value={aiLoading ? "..." : String(aiAnalysis?.detection_count ?? 0)} tone={(aiAnalysis?.risk_score ?? 0) > 50 ? "amber" : "slate"} />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="w-full justify-start h-auto p-1 bg-slate-900/40 border border-slate-800 rounded-2xl mb-6 backdrop-blur-sm overflow-x-auto flex-nowrap no-scrollbar">
            <TabsTrigger value="transactions" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-teal-500 data-[state=active]:text-slate-950 font-bold text-xs uppercase tracking-widest transition-all">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="connections" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-teal-500 data-[state=active]:text-slate-950 font-bold text-xs uppercase tracking-widest transition-all">
              Connection Graph
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-teal-500 data-[state=active]:text-slate-950 font-bold text-xs uppercase tracking-widest transition-all">
              AI Deep Scan
            </TabsTrigger>
            <TabsTrigger value="alchemy" onClick={() => void fetchAlchemyData()} className="rounded-xl px-6 py-2.5 data-[state=active]:bg-teal-500 data-[state=active]:text-slate-950 font-bold text-xs uppercase tracking-widest transition-all">
              Raw Chain Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-0 animate-in fade-in duration-500">
            <Card className="bg-slate-950/40 border-slate-800/80 rounded-[32px] overflow-hidden backdrop-blur-md shadow-2xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900/60 text-slate-500 border-b border-slate-800/50">
                      <tr>
                        <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px]">Movement</th>
                        <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px]">Counterparty</th>
                        <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px]">Value</th>
                        <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px]">Block Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 bg-slate-950/20">
                      {txLoading ? (
                         <tr><td colSpan={4} className="px-8 py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-500" /></td></tr>
                      ) : txs && txs.length > 0 ? (
                        txs.map((tx: any, i: number) => (
                          <tr key={tx.tx_hash} className="group hover:bg-slate-800/30 transition-all duration-200">
                            <td className="px-8 py-5">
                              {tx.direction === "out" 
                                ? <div className="flex items-center gap-3 text-slate-400 font-bold"><div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center group-hover:bg-slate-800"><ArrowUpRight className="h-4 w-4" /></div> SEND</div>
                                : <div className="flex items-center gap-3 text-teal-400 font-bold"><div className="h-8 w-8 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20"><ArrowDownLeft className="h-4 w-4" /></div> RECEIVE</div>
                              }
                            </td>
                            <td className="px-8 py-5">
                              <Link href={`/insights/wallet/${tx.counterparty}${contextQuery}`} className="font-mono text-xs text-slate-400 hover:text-teal-400 transition-colors">
                                {tx.counterparty}
                              </Link>
                            </td>
                            <td className="px-8 py-5 font-black text-white text-base">
                              {formatEth(tx.value_eth)}
                            </td>
                            <td className="px-8 py-5 text-slate-500 text-xs font-medium">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">No transactions found for this address.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections" className="mt-0 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <Card className="bg-slate-950/40 border-slate-800/80 rounded-[32px] p-12 min-h-[500px] flex items-center justify-center backdrop-blur-md">
                   <div className="text-center max-w-sm">
                      <div className="relative mb-8 mx-auto w-24 h-24">
                        <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping" />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 border border-teal-500/30">
                           <Brain className="h-10 w-10 text-teal-400" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Analyzing Multi-hop Flows</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">AI is mapping the hidden relationships between this address and {connections?.connections?.length || 0} unique counterparties.</p>
                      
                      <div className="mt-8 w-full h-[400px]">
                         <WalletNetworkGraph 
                            centerAddress={address} 
                            connections={connections?.connections || []} 
                            onNodeClick={(addr) => router.push(`/insights/wallet/${addr}${contextQuery}`)}
                         />
                      </div>
                   </div>
                </Card>
              </div>
              <div className="lg:col-span-4 space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] px-2">Counterparty Risk Mix</h3>
                {connLoading ? (
                  <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-700" /></div>
                ) : connections?.connections?.map((conn: any, i: number) => (
                   <div key={i} className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400"><Link2 className="h-3.5 w-3.5" /></div>
                        <div>
                          <p className="text-xs font-mono text-slate-300">{shortAddress(conn.address)}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">{conn.direction} interaction</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">{conn.tx_count} TX</p>
                        <p className="text-[10px] text-teal-500 font-black">{formatEth(conn.total_value_eth)}</p>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 animate-in fade-in duration-500">
             <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-slate-950/40 border-slate-800/80 rounded-[32px] p-8 backdrop-blur-md">
                   <div className="flex items-center gap-4 mb-8 text-teal-400">
                      <ShieldCheck className="h-8 w-8" />
                      <h3 className="text-xl font-black uppercase tracking-tighter">Behavioral Analysis</h3>
                   </div>
                   
                   <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                            { subject: 'Money Laundering', A: (aiAnalysis?.details?.money_laundering?.confidence || 0) * 100, full: 100 },
                            { subject: 'Wash Trading', A: (aiAnalysis?.details?.wash_trading?.confidence || 0) * 100, full: 100 },
                            { subject: 'Scam Activity', A: (aiAnalysis?.details?.scam?.confidence || 0) * 100, full: 100 },
                            { subject: 'Structure Risk', A: (aiAnalysis?.risk_score || 0) * 0.8, full: 100 },
                            { subject: 'Clustering', A: (aiAnalysis?.detection_count || 0) * 20, full: 100 },
                         ]}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Risk Level" dataKey="A" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.5} />
                         </RadarChart>
                      </ResponsiveContainer>
                   </div>

                   <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
                         <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Risk Confidence</p>
                         <p className="text-2xl font-black text-white">{aiAnalysis?.risk_score?.toFixed(1) || 0}%</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
                         <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Detections</p>
                         <p className="text-2xl font-black text-white">{aiAnalysis?.detection_count || 0}</p>
                      </div>
                   </div>
                </Card>

                <Card className="bg-slate-950/40 border-slate-800/80 rounded-[32px] p-8 backdrop-blur-md">
                   <div className="flex items-center gap-4 mb-8 text-amber-500">
                      <Brain className="h-8 w-8" />
                      <h3 className="text-xl font-black uppercase tracking-tighter">Neural Verdict</h3>
                   </div>
                   <div className="space-y-6">
                      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
                         <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">AI Summary</p>
                         <p className="text-sm text-slate-300 leading-relaxed italic">
                            &quot;{aiAnalysis?.ai_insight || "Analyzing behavioral signatures against multi-chain clusters. Waiting for scan completion..."}&quot;
                         </p>
                      </div>
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Heuristic Indicators</h4>
                         {(aiAnalysis?.details?.money_laundering?.reasons || []).concat(aiAnalysis?.details?.scam?.reasons || []).length > 0 ? (
                           (aiAnalysis?.details?.money_laundering?.reasons || []).concat(aiAnalysis?.details?.scam?.reasons || []).slice(0, 4).map((reason: string, idx: number) => (
                             <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400">
                                <AlertTriangle className="h-3.5 w-3.5" /> {reason}
                             </div>
                           ))
                         ) : (
                           <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 text-xs text-teal-400">
                              <ShieldCheck className="h-3.5 w-3.5" /> No specific heuristic triggers detected.
                           </div>
                         )}
                      </div>
                   </div>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="alchemy" className="mt-0 animate-in fade-in duration-500">
            <Card className="bg-slate-950/40 border-slate-800/80 rounded-[32px] p-8 backdrop-blur-md">
              {alchemyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                   <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
                   <p className="text-sm font-mono text-slate-500 uppercase tracking-widest">Querying Global Chain Indexer...</p>
                </div>
              ) : alchemyData ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Database className="h-5 w-5 text-teal-400" />
                       <h3 className="text-lg font-bold text-white">External RPC Provider (Alchemy)</h3>
                    </div>
                    <Badge variant="outline" className="border-teal-500/30 text-teal-400 bg-teal-500/5">LIVE NODE ACCESS</Badge>
                  </div>
                  <div className="relative">
                    <div className="absolute top-4 right-4 text-[10px] font-mono text-teal-500/50">RAW_JSON_BLOCK</div>
                    <pre className="bg-slate-950 p-8 rounded-2xl border border-slate-800/60 overflow-auto max-h-[600px] text-xs font-mono text-teal-300/80 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                      {JSON.stringify(alchemyData, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-6 border-2 border-dashed border-slate-800 rounded-2xl">
                   <Database className="h-12 w-12 text-slate-800" />
                   <p className="text-slate-500 text-center max-w-sm italic">Click the tab again to force-pull raw diagnostic data from the Alchemy production node for this address.</p>
                   <Button onClick={() => void fetchAlchemyData()} className="bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800">Pull Fresh Chain Data</Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ title, value, tone }: { title: string; value: string; tone: "teal" | "slate" | "amber" | "red" }) {
  const styles = {
    teal: "border-teal-500/20 bg-teal-500/5 text-teal-400",
    slate: "border-slate-800 bg-slate-900/40 text-slate-300",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    red: "border-red-500/20 bg-red-500/5 text-red-400"
  };
  
  return (
    <div className={`rounded-2xl border p-6 backdrop-blur-sm transition-all hover:scale-[1.02] ${styles[tone]}`}>
      <p className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 mb-2">{title}</p>
      <p className="text-2xl font-black tracking-tight text-white">{value}</p>
    </div>
  );
}

function InsightFallback({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-slate-400">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
        <p className="font-mono text-xs uppercase tracking-widest">{title} Initializing...</p>
      </div>
    </div>
  );
}

function Globe2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
    </svg>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-12 text-center text-sm text-slate-500 italic">{message}</div>;
}

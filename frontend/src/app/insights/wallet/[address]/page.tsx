"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Link2, Wallet } from "lucide-react";
import { fetchWalletConnections, fetchWalletStats, fetchWalletTransactionHistory } from "@/lib/api";

function shortAddress(address: string): string {
  if (!address) return "-";
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function WalletInsightPage() {
  const params = useParams<{ address: string }>();
  const searchParams = useSearchParams();
  const address = decodeURIComponent(params.address || "").toLowerCase();
  const role = searchParams.get("role");
  const feature = searchParams.get("feature");
  const backQuery = role || feature ? `?${new URLSearchParams({ role: role ?? "system_admin", feature: feature ?? "0" }).toString()}` : "";
  const backHref = `/${backQuery}`;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["walletInsightStats", address],
    queryFn: () => fetchWalletStats(address),
    enabled: !!address,
  });

  const { data: txs, isLoading: txLoading } = useQuery({
    queryKey: ["walletInsightTx", address],
    queryFn: () => fetchWalletTransactionHistory(address, 30),
    enabled: !!address,
  });

  const { data: connections, isLoading: connLoading } = useQuery({
    queryKey: ["walletInsightConnections", address],
    queryFn: () => fetchWalletConnections(address),
    enabled: !!address,
  });

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">Wallet Drill-down</h1>
            <p className="mt-1 font-mono text-sm text-slate-400">{address}</p>
          </div>
          <div className="text-xs text-slate-500">
            <Link href={backHref} className="hover:text-slate-300">Dashboard</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">Wallet insight</span>
          </div>
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            Back to context
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric title="ETH sent" value={statsLoading || !stats ? "-" : stats.eth_sent.toFixed(4)} />
          <Metric title="ETH received" value={statsLoading || !stats ? "-" : stats.eth_received.toFixed(4)} />
          <Metric title="Balance" value={statsLoading || !stats ? "-" : stats.eth_balance.toFixed(4)} />
          <Metric title="Total tx" value={statsLoading || !stats ? "-" : String(stats.total_transactions)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">Recent Transactions</h2>
            {txLoading ? (
              <p className="text-slate-400">Loading transactions...</p>
            ) : (
              <div className="space-y-2">
                {(txs || []).slice(0, 12).map((tx) => (
                  <div key={tx.tx_hash} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">{tx.direction.toUpperCase()}</span>
                      <span className="text-cyan-300">{tx.value_eth.toFixed(4)} ETH</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{shortAddress(tx.counterparty)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(tx.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="mb-3 text-lg font-semibold text-white">Top Connections</h2>
            {connLoading ? (
              <p className="text-slate-400">Loading connections...</p>
            ) : (
              <div className="space-y-2">
                {(connections?.connections || []).slice(0, 12).map((item) => (
                  <div key={`${item.direction}-${item.address}`} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-slate-200">
                        <Link2 className="h-3.5 w-3.5 text-slate-400" />
                        {item.direction}
                      </span>
                      <span className="text-amber-300">{item.tx_count} tx</span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{shortAddress(item.address)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.total_value_eth.toFixed(4)} ETH</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

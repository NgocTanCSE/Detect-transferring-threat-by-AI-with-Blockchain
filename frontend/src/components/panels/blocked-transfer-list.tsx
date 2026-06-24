"use client";

import type { BlockedTransfer } from "@/lib/api";
import {
  EmptyState,
  formatAddress,
  formatEth,
} from "../dashboard-utils";

export default function BlockedTransferList({ blockedTransfers }: { blockedTransfers: BlockedTransfer[] }) {
  if (!blockedTransfers.length) {
    return <EmptyState message="No blocked transfers were returned by the backend." />;
  }

  return (
    <div className="space-y-2">
      {blockedTransfers.slice(0, 8).map((item) => (
        <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{formatAddress(item.sender_address)} → {formatAddress(item.receiver_address)}</p>
              <p className="mt-1 text-xs text-slate-500">{item.block_reason}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{formatEth(item.amount_eth)}</p>
              <p className="mt-1 text-xs text-slate-500">Risk {item.risk_score.toFixed(1)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import type { Alert } from "@/lib/api";
import {
  EmptyState,
  SeverityPill,
  formatAddress,
} from "../dashboard-utils";

export default function AlertList({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) {
    return <EmptyState message="No recent alerts were returned by the backend." />;
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 8).map((alert) => (
        <div key={alert.alert_id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{alert.message}</p>
              <p className="mt-1 text-xs text-slate-500">{formatAddress(alert.wallet_address)} · {alert.alert_type}</p>
            </div>
            <SeverityPill severity={alert.severity} />
          </div>
        </div>
      ))}
    </div>
  );
}

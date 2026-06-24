"use client";

import { useMemo, useState } from "react";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LogVolumeTrend from "./log-volume-trend";

export default function RawAuditLogsPanel({ logs, onRefresh }: { logs: any[]; onRefresh: () => void }) {
  const [filterId, setFilterId] = useState("");

  const filteredLogs = useMemo(() => {
    if (!filterId) return logs;
    return logs.filter(log => 
      (log.correlation_id && log.correlation_id.includes(filterId)) || 
      (log.details?.correlation_id && log.details.correlation_id.includes(filterId))
    );
  }, [logs, filterId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-6 mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Activity Trend</h3>
        <LogVolumeTrend logs={logs} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Trace by ID (Correlation ID)..." 
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 rounded-xl text-xs"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="text-slate-400 hover:text-white">
          <RefreshCcw className="h-4 w-4 mr-2" /> Refresh Logs
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium">Trace ID</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {filteredLogs.length > 0 ? filteredLogs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-teal-500/70">{log.correlation_id || log.details?.correlation_id || "N/A"}</td>
                <td className="px-4 py-3 font-semibold text-teal-400">{log.action_type || log.log_type}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{log.user_identifier || "system"}</td>
                <td className="px-4 py-3 max-w-md truncate text-slate-300">{log.message || JSON.stringify(log.details)}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">No logs match your trace ID.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

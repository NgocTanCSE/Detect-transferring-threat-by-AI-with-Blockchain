"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { sendTestNotification } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MetricBlock } from "../dashboard-utils";

export default function SecurityOpsPanel({ feedbackStats }: { feedbackStats: { total_feedback: number; avg_sentiment?: number; categories: Record<string, number> } | null }) {
  const { notify } = useToast();
  const [isSending, setIsSending] = useState(false);

  async function handleTestNotification() {
    setIsSending(true);
    try {
      const res = await sendTestNotification();
      notify(`Test notification sent: ${res.message}`, "success");
    } catch (err) {
      notify("Failed to send test notification", "error");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h3 className="text-lg font-bold text-white mb-2">User Feedback Trends</h3>
          <p className="text-sm text-slate-400 mb-6">Analyzing community reports for false positives and emerging scams.</p>
          
          <div className="space-y-4">
            <MetricBlock 
              label="Total Reports" 
              value={feedbackStats ? String(feedbackStats.total_feedback) : "0"} 
              helper="Last 30 days" 
              tone="slate" 
            />
            <div className="grid grid-cols-2 gap-2">
              {feedbackStats && Object.entries(feedbackStats.categories).map(([cat, count]) => (
                <div key={cat} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">{cat}</p>
                  <p className="text-lg font-bold text-white">{count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">System Diagnostics</h3>
            <p className="text-sm text-slate-400 mb-6">Verify that the alerting pipeline and WebSocket broadcasters are fully operational.</p>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20">
              <div className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                <p className="text-xs text-teal-200/80 italic">Broadcaster status: Listening for new-threat events...</p>
              </div>
            </div>
            
            <Button 
              onClick={() => void handleTestNotification()} 
              disabled={isSending}
              className="w-full h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Dispatch Test Security Alert
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

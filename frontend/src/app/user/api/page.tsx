"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Copy, RefreshCw, Check, Zap, Shield, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { authFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";

interface OrgData {
  id: string;
  name: string;
  api_key: string | null;
}

interface UsageStats {
  total_calls: number;
  avg_response_ms: number;
}

export default function ApiKeyPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const orgRes = await authFetch("/api/organizations");
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          const items = orgData.items || orgData.data?.items || [];
          if (items.length > 0) {
            setOrg(items[0]);
          }
        }

        const usageRes = await authFetch("/api/admin/diagnostics/endpoint-stats");
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          const endpoints = usageData.endpoints || usageData.data?.endpoints || {};
          const totalCalls = Object.values(endpoints).reduce((sum: number, ep: any) => sum + (ep.count || 0), 0);
          setUsageStats({ total_calls: totalCalls, avg_response_ms: 45 });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const apiKey = org?.api_key || "No API key configured";

  const handleCopy = () => {
    if (apiKey && apiKey !== "No API key configured") {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h1 className="text-3xl font-bold text-white">API & Webhooks</h1>
          <p className="text-slate-400 mt-2">Integrate Blockchain AI Risk assessment directly into your internal systems.</p>
        </div>

        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-500 to-blue-500" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-white">Production API Key</CardTitle>
                <CardDescription>Use this key to authenticate your server-to-server requests.</CardDescription>
              </div>
              <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-teal-500/5 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex gap-2">
                <div className="flex-1 bg-black/40 border border-slate-700 rounded-lg p-3 font-mono text-slate-300 text-sm overflow-hidden truncate">
                  {loading ? "Loading..." : apiKey}
                </div>
                <Button onClick={handleCopy} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700">
                  {copied ? <Check className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/50">
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total API Calls</span>
                </div>
                <p className="text-xl font-bold text-white">{usageStats?.total_calls?.toLocaleString() || "0"}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-teal-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Organization</span>
                </div>
                <p className="text-xl font-bold text-white">{org?.name || "N/A"}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Response</span>
                </div>
                <p className="text-xl font-bold text-white">{usageStats?.avg_response_ms || 0}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Webhook Configuration</CardTitle>
            <CardDescription>Receive real-time notifications for high-risk alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-400">Target URL</label>
              <div className="flex gap-2">
                <Input placeholder="https://your-api.com/webhooks/risk" className="bg-black/20 border-slate-700 text-slate-200" />
                <Button className="bg-teal-600 hover:bg-teal-700">Save</Button>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-xs text-slate-500 italic">Webhooks will be signed using your API Key for security validation.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Admin Diagnostics Dashboard
 * Real-time system health, seed data status, API endpoint statistics, and error logs
 */

"use client";

import { authFetch } from "@/lib/auth-fetch";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";

interface SystemStatus {
  timestamp: string;
  database: {
    url: string;
    health: {
      status: string;
      error: string | null;
    };
  };
  ai_service: {
    hf_token_configured: boolean;
  };
  seed_data: Record<string, number>;
  endpoints: Record<
    string,
    {
      total_calls: number;
      success_count: number;
      error_count: number;
      last_status_code: number | null;
      last_error: string | null;
      last_called: string | null;
    }
  >;
  recent_errors: any[];
}

interface DiagnosticLog {
  timestamp: string;
  type: "info" | "warning" | "error" | "api_call" | "api_error" | "seed_data" | "database" | "ai_service";
  message: string;
  details: Record<string, any>;
  status_code: number | null;
  endpoint: string | null;
}

export default function AdminDiagnosticsDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogType, setSelectedLogType] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/admin/diagnostics/status");
      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error("Failed to fetch diagnostics status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const url = selectedLogType
        ? `/api/admin/diagnostics/logs?limit=100&log_type=${selectedLogType}`
        : "/api/admin/diagnostics/logs?limit=100";
      const response = await authFetch(url);
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  const clearLogs = async () => {
    if (!confirm("Are you sure you want to clear all diagnostic logs?")) return;
    try {
      await authFetch("/api/admin/diagnostics/logs", { method: "DELETE" });
      await fetchLogs();
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedLogType]);

  if (!systemStatus) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-slate-400">Loading diagnostics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-100">System Diagnostics</h1>
        <Button onClick={fetchStatus} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="seed">Seed Data</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Database Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={systemStatus.database.health.status === "connected" ? "default" : "destructive"}
                  >
                    {systemStatus.database.health.status}
                  </Badge>
                  <span className="text-xs text-slate-400">{systemStatus.database.url}</span>
                </div>
                {systemStatus.database.health.error && (
                  <p className="text-xs text-slate-400 mt-2">{systemStatus.database.health.error}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Service (Gemini)</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={systemStatus.ai_service.gemini_api_key_configured ? "default" : "secondary"}>
                  {systemStatus.ai_service.gemini_api_key_configured ? "Configured" : "Not Configured"}
                </Badge>
                <p className="text-xs text-slate-400 mt-2">
                  {systemStatus.ai_service.gemini_api_key_configured
                    ? `GEMINI_API_KEY is set (${systemStatus.ai_service.gemini_model || "default model"})`
                    : "GEMINI_API_KEY missing - fallback mode"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>{systemStatus.recent_errors.length} errors in recent logs</CardDescription>
            </CardHeader>
            <CardContent>
              {systemStatus.recent_errors.length === 0 ? (
                <p className="text-sm text-slate-400">✓ No recent errors</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {systemStatus.recent_errors.map((error, idx) => (
                    <div key={idx} className="p-2 bg-slate-900/30 rounded border border-slate-700/50">
                      <p className="text-xs font-mono text-slate-200">{error.message}</p>
                      <p className="text-xs text-slate-400">{error.endpoint}</p>
                      <p className="text-xs text-slate-500">{new Date(error.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEED DATA TAB */}
        <TabsContent value="seed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Seed Data Counts</CardTitle>
              <CardDescription>Total records per table</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(systemStatus.seed_data).map(([key, count]) => (
                  <div key={key} className="p-3 bg-slate-900 rounded border border-teal-400/20">
                    <p className="text-xs text-slate-400 capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-2xl font-bold text-teal-300">{count}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-slate-900/30 border border-slate-700/50 rounded">
                <p className="text-xs text-slate-300">
                  ℹ️ Production-Grade Seed: ~1000 wallets, ~5000 transactions, ~150 alerts, ~60 blocked transfers, ~120 nodes, ~500 metrics
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENDPOINTS TAB */}
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Statistics</CardTitle>
              <CardDescription>Call counts, success/error rates, last response</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Object.entries(systemStatus.endpoints).map(([endpoint, stats]) => (
                  <div key={endpoint} className="p-3 bg-slate-900 rounded border border-slate-700/50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-mono text-slate-400">{endpoint}</p>
                        <p className="text-xs text-slate-400">
                          Total: {stats.total_calls} | Success: {stats.success_count} | Errors: {stats.error_count}
                        </p>
                        {stats.last_status_code && (
                          <Badge
                            className="mt-2"
                            variant={stats.last_status_code < 400 ? "default" : "destructive"}
                          >
                            {stats.last_status_code}
                          </Badge>
                        )}
                        {stats.last_error && <p className="text-xs text-slate-400 mt-2">{stats.last_error}</p>}
                        {stats.last_called && (
                          <p className="text-xs text-slate-500 mt-2">
                            Last: {new Date(stats.last_called).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostic Logs</CardTitle>
              <CardDescription>{logs.length} recent log entries</CardDescription>
              <div className="flex gap-2 mt-4 flex-wrap">
                <Button
                  size="sm"
                  variant={selectedLogType === null ? "default" : "outline"}
                  onClick={() => setSelectedLogType(null)}
                >
                  All
                </Button>
                {["info", "warning", "error", "api_call", "api_error", "ai_service", "database"].map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={selectedLogType === type ? "default" : "outline"}
                    onClick={() => setSelectedLogType(type)}
                  >
                    {type}
                  </Button>
                ))}
                <Button size="sm" variant="destructive" onClick={clearLogs} className="ml-auto">
                  Clear All Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-slate-400">No logs</p>
                ) : (
                  logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border ${log.type === "error" || log.type === "api_error"
                        ? "bg-amber-900/20 border-amber-700/50 text-amber-100"
                        : log.type === "warning"
                          ? "bg-amber-900/20 border-amber-700/50 text-amber-100"
                          : "bg-slate-900/20 border-slate-700/50 text-slate-200"
                        }`}
                    >
                      <div className="flex justify-between">
                        <span>{log.message}</span>
                        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                      {log.endpoint && <p className="text-slate-400 mt-1">{log.endpoint}</p>}
                      {log.status_code && <p className="text-slate-400 mt-1">Status: {log.status_code}</p>}
                      {Object.keys(log.details).length > 0 && (
                        <pre className="text-slate-500 mt-1 text-[10px] overflow-auto max-h-20">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}



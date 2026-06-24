"use client";

import { useState, useEffect } from "react";
import { NodeEndpointItem, EmptyState, unwrapPayload } from "../dashboard-utils";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";

function NodeTable({ nodes }: { nodes: NodeEndpointItem[] }) {
  const { notify } = useToast();
  const [mutableNodes, setMutableNodes] = useState(nodes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableNodes(nodes);
  }, [nodes]);

  async function reloadNodes() {
    const response = await authFetch("/api/ops/system/node-endpoints?only_active=true");
    if (!response.ok) throw new Error("Failed to reload node endpoints");
    const payload = await response.json();
    const data = unwrapPayload<{ items: NodeEndpointItem[] }>(payload);
    setMutableNodes(data.items || []);
  }

  async function handleCreateNode() {
    const providerName = window.prompt("Provider name", "Manual Node");
    if (!providerName || !providerName.trim()) return;
    const chain = window.prompt("Chain", "ethereum");
    if (!chain || !chain.trim()) return;
    const endpointUrl = window.prompt("Endpoint URL", "https://example-node.local/rpc");
    if (!endpointUrl || !endpointUrl.trim()) return;
    const protocol = (window.prompt("Protocol (http/websocket)", "http") || "http").toLowerCase();
    if (!["http", "websocket"].includes(protocol)) {
      notify("Protocol phải là http hoặc websocket", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch("/api/ops/system/node-endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: providerName.trim(),
          chain: chain.trim(),
          endpoint_url: endpointUrl.trim(),
          protocol,
          priority: 100,
          is_active: true,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create node endpoint");
      }
      await reloadNodes();
      notify("Node endpoint created", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create node endpoint";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateHealth(node: NodeEndpointItem, healthStatus: "healthy" | "degraded" | "down" | "unknown") {
    setIsSubmitting(true);
    try {
      const lastError = healthStatus === "down" ? (window.prompt("Last error (optional)") ?? "") : "";
      const response = await authFetch(`/api/ops/system/node-endpoints/${encodeURIComponent(node.id)}/health`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_status: healthStatus,
          last_error: lastError || null,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update node health");
      }

      setMutableNodes((previous) =>
        previous.map((item) =>
          item.id === node.id
            ? {
              ...item,
              health_status: healthStatus,
              last_error: healthStatus === "down" ? (lastError || item.last_error) : null,
              last_checked_at: new Date().toISOString(),
            }
            : item
        )
      );
      notify(`Node ${node.provider_name} health -> ${healthStatus.toUpperCase()}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update node health";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableNodes.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleCreateNode()}
          className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Add node endpoint
        </button>
        <EmptyState message="No node records to display." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleCreateNode()}
        className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Add node endpoint
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Provider</th>
              <th className="px-4 py-3 text-left font-medium">Chain</th>
              <th className="px-4 py-3 text-left font-medium">Health</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableNodes.map((node, i) => (
              <tr key={node.id} className="animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both" style={{ animationDelay: `${i * 30}ms` }}>
                <td className="px-4 py-3">{node.provider_name}</td>
                <td className="px-4 py-3">{node.chain}</td>
                <td className="px-4 py-3">{node.health_status}</td>
                <td className="px-4 py-3">{node.priority}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "healthy")}
                      className="rounded-md border border-teal-400/40 bg-teal-400/10 px-2 py-1 text-[11px] text-teal-50 disabled:opacity-60"
                    >
                      Healthy
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "degraded")}
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                    >
                      Degraded
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleUpdateHealth(node, "down")}
                      className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-50 disabled:opacity-60"
                    >
                      Down
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default NodeTable;

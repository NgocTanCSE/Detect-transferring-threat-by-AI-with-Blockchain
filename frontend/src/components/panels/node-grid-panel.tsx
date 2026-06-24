"use client";

import { NodeEndpointItem, EmptyState, SeverityPill, formatDateTime } from "../dashboard-utils";

function NodeGrid({ nodes }: { nodes: NodeEndpointItem[] }) {
  if (!nodes.length) {
    return <EmptyState message="No active node endpoints were returned by the backend." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {nodes.map((node, i) => (
        <div key={node.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{node.provider_name}</p>
              <p className="mt-1 text-xs text-slate-400">{node.chain} · {node.protocol}</p>
            </div>
            <SeverityPill severity={node.health_status.toUpperCase()} />
          </div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>Endpoint: {node.endpoint_url}</p>
            <p>Priority: {node.priority}</p>
            <p>Checked: {formatDateTime(node.last_checked_at)}</p>
            {node.last_error ? <p className="rounded bg-amber-400/10 px-2 py-1 text-amber-50">Error: {node.last_error}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default NodeGrid;

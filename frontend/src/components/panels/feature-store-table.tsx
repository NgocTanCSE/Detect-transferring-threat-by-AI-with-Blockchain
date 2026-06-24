"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";
import { EmptyState, formatDateTime, unwrapPayload } from "../dashboard-utils";
import type { FeatureConfigItem } from "../dashboard-utils";

function FeatureStoreTable({ features }: { features: FeatureConfigItem[] }) {
  const { notify } = useToast();
  const [mutableFeatures, setMutableFeatures] = useState(features);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableFeatures(features);
  }, [features]);

  async function handleCreateFeature() {
    const featureKey = window.prompt("Feature key (unique), ví dụ: suspicious_velocity_flag");
    if (!featureKey || !featureKey.trim()) return;
    const expression = window.prompt("Expression (optional)") ?? "";

    setIsSubmitting(true);
    try {
      const response = await authFetch("/api/ops/ai/feature-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature_key: featureKey.trim(),
          enabled: true,
          expression: expression.trim() || null,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to create feature");
      }

      const listResponse = await authFetch("/api/ops/ai/feature-store");
      if (!listResponse.ok) throw new Error("Failed to reload features");
      const payload = await listResponse.json();
      const data = unwrapPayload<{ items: FeatureConfigItem[] }>(payload);
      setMutableFeatures(data.items || []);
      notify("Feature created", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create feature";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleFeature(feature: FeatureConfigItem) {
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/ops/ai/feature-store/${encodeURIComponent(feature.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !feature.enabled }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to update feature");
      }

      setMutableFeatures((previous) =>
        previous.map((item) =>
          item.id === feature.id
            ? { ...item, enabled: !item.enabled, updated_at: new Date().toISOString() }
            : item
        )
      );
      notify(`Feature ${feature.feature_key} ${feature.enabled ? "disabled" : "enabled"}`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update feature";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableFeatures.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleCreateFeature()}
          className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Add feature
        </button>
        <EmptyState message="Feature store is empty." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleCreateFeature()}
        className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Add feature
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Feature</th>
              <th className="px-4 py-3 text-left font-medium">Enabled</th>
              <th className="px-4 py-3 text-left font-medium">Expression</th>
              <th className="px-4 py-3 text-left font-medium">Updated</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableFeatures.slice(0, 50).map((feature) => (
              <tr key={feature.id}>
                <td className="px-4 py-3">{feature.feature_key}</td>
                <td className="px-4 py-3">{feature.enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{feature.expression ?? "-"}</td>
                <td className="px-4 py-3">{formatDateTime(feature.updated_at)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleToggleFeature(feature)}
                    className="rounded-lg border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-400/60 disabled:opacity-60"
                  >
                    {feature.enabled ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FeatureStoreTable;

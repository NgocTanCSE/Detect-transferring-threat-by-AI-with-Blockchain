"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";
import { EmptyState, MetricBlock, formatCompact, unwrapPayload } from "../dashboard-utils";
import type { ModelRegistryItem } from "../dashboard-utils";

function ModelRegistryTable({ models, activeModels }: { models: ModelRegistryItem[]; activeModels: ModelRegistryItem[] }) {
  const { notify } = useToast();
  const [mutableModels, setMutableModels] = useState(models);
  const [mutableActiveModels, setMutableActiveModels] = useState(activeModels);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMutableModels(models);
  }, [models]);

  useEffect(() => {
    setMutableActiveModels(activeModels);
  }, [activeModels]);

  const activeNames = new Set(mutableActiveModels.map((item) => `${item.model_name}:${item.version}`));

  async function reloadModels() {
    const [allResponse, activeResponse] = await Promise.all([
      fetch("/api/ops/ai/model-registry"),
      fetch("/api/ops/ai/model-registry/active"),
    ]);
    if (!allResponse.ok || !activeResponse.ok) throw new Error("Failed to reload model registry");

    const [allPayload, activePayload] = await Promise.all([allResponse.json(), activeResponse.json()]);
    const allData = unwrapPayload<{ items: ModelRegistryItem[] }>(allPayload);
    const activeData = unwrapPayload<{ items: ModelRegistryItem[] }>(activePayload);
    setMutableModels(allData.items || []);
    setMutableActiveModels(activeData.items || []);
  }

  async function handleRegisterModel() {
    const modelName = window.prompt("Model name", "risk_detector");
    if (!modelName || !modelName.trim()) return;
    const version = window.prompt("Version", "v1.0.0");
    if (!version || !version.trim()) return;
    const artifactUri = window.prompt("Artifact URI", "s3://ml-artifacts/risk_detector/v1.0.0");
    if (!artifactUri || !artifactUri.trim()) return;
    const framework = (window.prompt("Framework (pkl/onnx/pt)", "pkl") || "pkl").toLowerCase();
    if (!["pkl", "onnx", "pt"].includes(framework)) {
      notify("Framework phải là pkl, onnx hoặc pt", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch("/api/ops/ai/model-registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_name: modelName.trim(),
          version: version.trim(),
          artifact_uri: artifactUri.trim(),
          framework,
          is_active: false,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to register model");
      }
      await reloadModels();
      notify("Model registered", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to register model";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActivateModel(model: ModelRegistryItem) {
    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/ops/ai/model-registry/${encodeURIComponent(model.id)}/activate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to activate model");
      }
      await reloadModels();
      notify(`Model ${model.model_name} ${model.version} activated`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to activate model";
      notify(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mutableModels.length && !mutableActiveModels.length) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleRegisterModel()}
          className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
        >
          Register model
        </button>
        <EmptyState message="Model registry is empty." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricBlock label="Registry entries" value={formatCompact(mutableModels.length)} helper="Current records" tone="teal" />
        <MetricBlock label="Active models" value={formatCompact(mutableActiveModels.length)} helper="Serving now" tone="teal" />
        <MetricBlock label="Frameworks" value={formatCompact(new Set(mutableModels.map((item) => item.framework)).size)} helper="Unique runtimes" tone="slate" />
        <MetricBlock label="Artifacts" value={formatCompact(mutableModels.length)} helper="Tracked versions" tone="slate" />
      </div>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={() => void handleRegisterModel()}
        className="inline-flex items-center rounded-xl border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:border-white/40 disabled:opacity-60"
      >
        Register model
      </button>
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Model</th>
              <th className="px-4 py-3 text-left font-medium">Version</th>
              <th className="px-4 py-3 text-left font-medium">Framework</th>
              <th className="px-4 py-3 text-left font-medium">Active</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {mutableModels.slice(0, 50).map((model) => {
              const isActive = model.is_active || activeNames.has(`${model.model_name}:${model.version}`);
              return (
                <tr key={model.id}>
                  <td className="px-4 py-3">{model.model_name}</td>
                  <td className="px-4 py-3">{model.version}</td>
                  <td className="px-4 py-3">{model.framework}</td>
                  <td className="px-4 py-3">{isActive ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={isSubmitting || isActive}
                      onClick={() => void handleActivateModel(model)}
                      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-2 py-1 text-[11px] text-slate-200 disabled:opacity-60"
                    >
                      {isActive ? "Active" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ModelRegistryTable;

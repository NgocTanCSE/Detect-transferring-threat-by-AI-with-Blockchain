"use client";

import { useState, useEffect } from "react";
import { unwrapPayload } from "../dashboard-utils";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";

function ApiAccessPanel() {
  const [keys, setKeys] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const { notify } = useToast();

  const fetchKeysAndOrgs = async () => {
    setIsLoading(true);
    try {
      const keysResponse = await authFetch("/api/ops/system/api-keys");
      const orgsResponse = await authFetch("/api/ops/system/organizations");
      if (keysResponse.ok && orgsResponse.ok) {
        const keysPayload = await keysResponse.json();
        const orgsPayload = await orgsResponse.json();
        const keysData = unwrapPayload<{ items: any[] }>(keysPayload);
        const orgsData = unwrapPayload<{ items: any[] }>(orgsPayload);
        setKeys(keysData.items || []);
        setOrgs(orgsData.items || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeysAndOrgs();
  }, []);

  const handleGenerateKey = async () => {
    if (!selectedOrgId) {
      notify("Please select an organization", "error");
      return;
    }

    try {
      const response = await authFetch(`/api/ops/system/api-keys?org_id=${encodeURIComponent(selectedOrgId)}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to generate API key");
      }
      notify("API key generated successfully!", "success");
      setShowGenerateModal(false);
      fetchKeysAndOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  const handleRevokeKey = async (orgId: string) => {
    if (!window.confirm("Are you sure you want to revoke this API key? This action is permanent!")) return;

    try {
      const response = await authFetch(`/api/ops/system/api-keys/${encodeURIComponent(orgId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to revoke API key");
      }
      notify("API Key revoked successfully!", "success");
      fetchKeysAndOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Active API Keys</h3>
          <p className="text-sm text-slate-400 mb-6">Provisioned keys for programmatic access to the risk engine.</p>
          <div className="space-y-4">
            {isLoading ? (
              <div className="animate-pulse h-24 bg-slate-900/20 rounded-xl"></div>
            ) : keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <div>
                  <div className="text-sm font-medium text-slate-200">{k.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{k.key}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-600">Created {k.created}</div>
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="text-red-400 hover:text-red-300 text-xs mt-1"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}

            {showGenerateModal ? (
              <div className="flex gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Select Organization...</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGenerateKey}
                  className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="w-full py-3 rounded-xl border border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-all text-sm font-medium"
              >
                + Generate New API Key
              </button>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Webhook Connectivity</h3>
          <p className="text-sm text-slate-400 mb-6">Real-time alert delivery status for your organization endpoints.</p>
          <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 mb-4">
             <div className="flex gap-3">
               <div className="mt-1 h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
               <div>
                 <div className="text-sm font-medium text-amber-200">Webhook Degraded</div>
                 <p className="text-xs text-amber-200/60 mt-1">GBV production endpoint returned 503 (6 consecutive failures).</p>
               </div>
             </div>
          </div>
          <button className="w-full py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-all text-sm font-medium">
            Configure Webhook URL
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApiAccessPanel;

"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrapPayload } from "../dashboard-utils";
import { useToast } from "@/lib/toast-context";
import { authFetch } from "@/lib/auth-fetch";

function OrganizationPanel() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { notify } = useToast();

  const fetchOrgs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authFetch("/api/ops/system/organizations");
      if (!response.ok) throw new Error("Failed to fetch organizations");
      const payload = await response.json();
      const data = unwrapPayload<{ items: any[] }>(payload);
      setOrgs(data.items || []);
    } catch (err: any) {
      console.error(err);
      notify("Failed to fetch organizations", "error");
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleCreateOrg = async () => {
    const name = window.prompt("Enter Organization Name:");
    if (!name || !name.trim()) return;
    const slug = window.prompt("Enter Organization Slug (lowercase, unique):");
    if (!slug || !slug.trim()) return;
    const contactEmail = window.prompt("Enter Contact Email:");
    if (!contactEmail || !contactEmail.trim()) return;

    try {
      const response = await authFetch("/api/ops/system/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          contact_email: contactEmail.trim(),
          is_active: true,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to create organization");
      }
      notify("Organization created successfully", "success");
      fetchOrgs();
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleCreateOrg}
          className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/20"
        >
          Create New Organization
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 text-left">Organization Name</th>
              <th className="px-6 py-4 text-left">Slug</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">API Calls (30d)</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-6 py-4 bg-slate-900/20 h-16"></td>
                </tr>
              ))
            ) : orgs.map((org) => (
              <tr key={org.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-100">{org.name}</td>
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{org.slug}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${org.status === "Active" ? "bg-teal-400/10 text-teal-400 border border-teal-400/20" : "bg-red-400/10 text-red-400 border border-red-400/20"}`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300">{org.api_calls}</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-slate-400 hover:text-white transition-colors">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OrganizationPanel;

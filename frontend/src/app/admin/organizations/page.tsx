"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, MoreVertical, Building2, ShieldCheck, ShieldAlert } from "lucide-react";
import { fetchOrganizations, type Organization } from "@/lib/api";

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations().then(data => {
      setOrganizations(data.items);
    }).catch(() => {
      setOrganizations([]);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const filteredOrgs = organizations.filter(org => 
    org.name.toLowerCase().includes(search.toLowerCase()) || 
    org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const orgs = loading ? [] : filteredOrgs;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading organizations...</p>
        </div>
      )}
      {!loading && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Organization Management</h1>
            <p className="text-slate-400 mt-1">Manage multi-tenant banking and exchange partners.</p>
          </div>
          <Button className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold">
            <Plus className="mr-2 h-4 w-4" /> Add New Tenant
          </Button>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input 
            placeholder="Search by name or slug..." 
            className="pl-10 bg-slate-900/50 border-slate-700/50 text-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="border-slate-700 text-slate-300">
          <Filter className="mr-2 h-4 w-4" /> Filter
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map((org) => (
          <Card key={org.id} className="bg-slate-900/40 border-slate-800 hover:border-teal-500/50 transition-all group">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="h-12 w-12 rounded-lg bg-slate-800 flex items-center justify-center text-teal-400 group-hover:bg-teal-500 group-hover:text-slate-950 transition-colors">
                  <Building2 className="h-6 w-6" />
                </div>
                <Button variant="ghost" size="icon" className="text-slate-500">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4">
                <CardTitle className="text-xl text-white">{org.name}</CardTitle>
                <CardDescription className="text-slate-500 font-mono text-xs">ID: {org.slug}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Status</span>
                  <Badge className={org.is_active ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>
                    {org.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Contact</span>
                  <span className="text-slate-300 text-xs">{org.contact_email || 'No email'}</span>
                </div>
                <Button variant="secondary" className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none">
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && orgs.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500">
            No organizations found. Add one to get started.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

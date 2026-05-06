"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Search, Plus, Filter, MoreVertical, ShieldCheck, ShieldAlert } from "lucide-react";

export default function OrganizationsPage() {
  const [search, setSearch] = useState("");

  const orgs = [
    { id: 1, name: "Vietcombank", slug: "vietcombank", status: "active", users: 12, api_calls: "1.2M", health: "Good" },
    { id: 2, name: "Binance Vietnam", slug: "binance-vn", status: "active", users: 45, api_calls: "8.5M", health: "Good" },
    { id: 3, name: "Techcombank", slug: "techcombank", status: "warning", users: 8, api_calls: "450K", health: "Suspicious Activity" },
    { id: 4, name: "Momo e-Wallet", slug: "momo", status: "active", users: 120, api_calls: "25M", health: "Good" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Organization Management</h1>
          <p className="text-slate-400 mt-1">Manage multi-tenant banking and exchange partners.</p>
        </div>
        <Button className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold">
          <Plus className="mr-2 h-4 w-4" /> Add New Tenant
        </Button>
      </div>

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
                  <Badge className={org.status === 'active' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}>
                    {org.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Security Health</span>
                  <div className="flex items-center gap-1">
                    {org.health === 'Good' ? <ShieldCheck className="h-4 w-4 text-teal-500" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
                    <span className={org.health === 'Good' ? 'text-teal-500' : 'text-amber-500'}>{org.health}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Users</p>
                    <p className="text-lg font-semibold text-white">{org.users}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">API Usage</p>
                    <p className="text-lg font-semibold text-white">{org.api_calls}</p>
                  </div>
                </div>
                <Button variant="secondary" className="w-full mt-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border-none">
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Radar,
  History,
  Shield,
  ChevronLeft,
  Activity,
  Loader2,
  LogOut,
  ShieldX,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "../../lib/auth-context";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    description: "AI Detection Overview",
  },
  {
    title: "Tracking",
    href: "/admin/tracking",
    icon: Radar,
    description: "Monitor Wallets",
  },
  {
    title: "History",
    href: "/admin/history",
    icon: History,
    description: "Blocked Transfers",
  },
  {
    title: "Logs",
    href: "/admin/diagnostics",
    icon: Activity,
    description: "System Diagnostics",
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Completely removed auth checking and redirecting for admin routes as per request

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Mock user for admin dashboard if not logged in
  const displayUser = user || { username: "Admin", role: "admin" };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-100">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-800/70 bg-slate-950/95 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/50 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-300 via-slate-100 to-amber-300">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-50">
              AI<span className="text-teal-300">Guard</span>
            </h1>
            <p className="text-xs text-slate-500">Admin Panel</p>
          </div>
        </div>

        {/* User Info */}
        <div className="border-b border-slate-800/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-300 to-amber-300">
              <span className="text-sm font-medium text-slate-950">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-50 truncate">{user?.username}</p>
              <p className="text-xs text-slate-300">Admin</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-slate-50 hover:bg-slate-800/50"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 p-4">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150",
                    isActive
                      ? "bg-slate-800 text-slate-50 border border-teal-400/30 shadow-[0_4px_12px_rgba(20,184,166,0.12)]"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-50 border border-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-teal-300" : ""
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
        <Separator className="mx-4 w-auto bg-slate-800/50" />

        {/* Status Indicator */}
        <div className="p-4">
          <div className="rounded-lg border border-teal-400/20 bg-teal-400/5 p-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-4 w-4 text-teal-300" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
              </div>
              <span className="text-sm text-slate-50">System Active</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">AI Engine Running</p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link href="/">
            <Button variant="outline" className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-slate-50">
              <ChevronLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64">
        <div className="min-h-screen p-6">{children}</div>
      </main>
    </div>
  );
}



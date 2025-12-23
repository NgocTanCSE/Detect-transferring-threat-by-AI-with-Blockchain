"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  History,
  Shield,
  ChevronLeft,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-cyber-bg-dark cyber-grid-bg">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-cyber-border bg-cyber-bg-darker/95 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-cyber-border px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-neon-cyan/10 border border-cyber-neon-cyan/30">
            <Shield className="h-6 w-6 text-cyber-neon-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-cyber-text-primary">
              AI<span className="text-cyber-neon-cyan">Guard</span>
            </h1>
            <p className="text-xs text-cyber-text-muted">Admin Panel</p>
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
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                    isActive
                      ? "bg-cyber-neon-cyan/10 border border-cyber-neon-cyan/30 text-cyber-neon-cyan shadow-neon-cyan"
                      : "text-cyber-text-secondary hover:bg-cyber-bg-elevated hover:text-cyber-text-primary border border-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-cyber-neon-cyan" : ""
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-cyber-text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <Separator className="mx-4 w-auto" />

        {/* Status Indicator */}
        <div className="p-4">
          <div className="rounded-lg border border-cyber-neon-green/30 bg-cyber-neon-green/5 p-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-4 w-4 text-cyber-neon-green" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-cyber-neon-green" />
              </div>
              <span className="text-sm text-cyber-neon-green">
                System Active
              </span>
            </div>
            <p className="mt-1 text-xs text-cyber-text-muted">
              AI Engine Running
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link href="/">
            <Button variant="outline" className="w-full">
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

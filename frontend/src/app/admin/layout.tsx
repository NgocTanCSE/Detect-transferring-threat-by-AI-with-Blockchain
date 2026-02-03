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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";

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
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Redirect non-admins to home
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== "admin")) {
      // Allow a brief delay for auth state to stabilize
      const timer = setTimeout(() => {
        if (!isAuthenticated) {
          router.push("/login");
        } else if (user?.role !== "admin") {
          // User is logged in but not admin
          router.push("/");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
          <p className="text-slate-400">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Show access denied
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
            <ShieldX className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Truy cập bị từ chối</h2>
          <p className="text-slate-400 max-w-md">
            {!isAuthenticated
              ? "Bạn cần đăng nhập để truy cập trang quản trị."
              : "Tài khoản của bạn không có quyền truy cập trang quản trị."}
          </p>
          <div className="flex gap-3 mt-4">
            {!isAuthenticated ? (
              <Link href="/login">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Đăng nhập
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Về trang chủ
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              AI<span className="text-cyan-400">Guard</span>
            </h1>
            <p className="text-xs text-slate-500">Admin Panel</p>
          </div>
        </div>

        {/* User Info */}
        <div className="border-b border-slate-700/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
              <span className="text-sm font-medium text-white">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-cyan-400">Admin</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/20"
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
                      ? "bg-slate-800 text-white border border-slate-600/50"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-cyan-400" : ""
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

        <Separator className="mx-4 w-auto bg-slate-700/50" />

        {/* Status Indicator */}
        <div className="p-4">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <span className="text-sm text-emerald-400">
                System Active
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              AI Engine Running
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link href="/">
            <Button variant="outline" className="w-full text-slate-300 border-slate-600 hover:bg-slate-800 hover:text-white">
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

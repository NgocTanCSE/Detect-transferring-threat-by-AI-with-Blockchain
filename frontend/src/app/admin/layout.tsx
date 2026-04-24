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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
          <p className="text-zinc-400">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Show access denied
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50">
            <ShieldX className="h-8 w-8 text-zinc-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Truy cập bị từ chối</h2>
          <p className="text-zinc-400 max-w-md">
            {!isAuthenticated
              ? "Bạn cần đăng nhập để truy cập trang quản trị."
              : "Tài khoản của bạn không có quyền truy cập trang quản trị."}
          </p>
          <div className="flex gap-3 mt-4">
            {!isAuthenticated ? (
              <Link href="/login">
                <Button className="bg-zinc-100 text-black hover:bg-zinc-200">
                  Đăng nhập
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button className="bg-zinc-100 text-black hover:bg-zinc-200">
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
    <div className="min-h-screen bg-[#08080a]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-zinc-800/50 bg-zinc-950/95 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800/50 px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-400">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">
              AI<span className="text-zinc-100">Guard</span>
            </h1>
            <p className="text-xs text-zinc-500">Admin Panel</p>
          </div>
        </div>

        {/* User Info */}
        <div className="border-b border-zinc-800/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-400">
              <span className="text-sm font-medium text-black">
                {user?.username?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-zinc-100">Admin</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
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
                      ? "bg-zinc-800 text-white border border-zinc-700/50 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white border border-transparent"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-white" : ""
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <Separator className="mx-4 w-auto bg-zinc-800/50" />

        {/* Status Indicator */}
        <div className="p-4">
          <div className="rounded-lg border border-zinc-100/20 bg-zinc-100/5 p-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-4 w-4 text-zinc-100" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-zinc-100 animate-pulse" />
              </div>
              <span className="text-sm text-zinc-100">
                System Active
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              AI Engine Running
            </p>
          </div>
        </div>

        {/* Back to Home */}
        <div className="absolute bottom-4 left-4 right-4">
          <Link href="/">
            <Button variant="outline" className="w-full text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white">
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



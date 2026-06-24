"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Clock,
  Wallet,
  User,
  Shield,
  ChevronLeft,
  TestTube,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [
    { href: "/user/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/user/exchange", label: "Giao Dịch", icon: ArrowLeftRight },
    { href: "/user/transactions", label: "Lịch Sử", icon: Clock },
    { href: "/user/wallet", label: "Ví", icon: Wallet },
    { href: "/user/profile", label: "Hồ Sơ", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#08080a] text-slate-100 flex">
      <aside className="fixed left-0 top-0 bottom-0 w-64 border-r border-slate-800/50 bg-[#0a0a0f]/95 backdrop-blur-xl z-40 flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/50">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">
              Sentinel<span className="text-teal-400">Wallet</span>
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800/50">
          <Link href="/user/test-env">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all cursor-pointer">
              <TestTube className="h-4 w-4" />
              Test Environment
            </div>
          </Link>
        </div>

        <div className="p-3 border-t border-slate-800/50">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username || "testuser"}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || "test@sentinel.io"}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

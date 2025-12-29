"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  History,
  User,
  ChevronLeft,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { href: "/user/exchange", label: "Exchange", icon: ArrowLeftRight },
    { href: "/user/history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Secure<span className="text-cyan-400">Wallet</span>
                </h1>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.filter(item => item.label !== "History").map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`gap-2 ${isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                      }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
              <User className="h-5 w-5 text-slate-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <div className="min-h-[calc(100vh-4rem)] p-6">{children}</div>
      </main>
    </div>
  );
}

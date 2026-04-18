"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  History,
  User,
  ChevronLeft,
  Shield,
  LogOut,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-context";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const navItems = [
    { href: "/user/exchange", label: "Exchange", icon: ArrowLeftRight },
    { href: "/user/history", label: "History", icon: History },
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-cyan-500 animate-spin" />
          <p className="text-slate-400">Đang tải...</p>
        </div>
      </div>
    );
  }

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

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-white max-w-[120px] truncate">
                      {user.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-slate-800 border-slate-700"
                >
                  <DropdownMenuLabel className="text-slate-300">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-white">{user.username}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  {user.wallet_address && (
                    <>
                      <DropdownMenuItem className="text-slate-300 focus:bg-slate-700 focus:text-white">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400">Wallet</span>
                          <span className="text-xs font-mono">
                            {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-700" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 focus:bg-red-500/20 focus:text-red-300 cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" className="text-slate-400 hover:text-white">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-cyan-600 hover:bg-cyan-700 text-white">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )}
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

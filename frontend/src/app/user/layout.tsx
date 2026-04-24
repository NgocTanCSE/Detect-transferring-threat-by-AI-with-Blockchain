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
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useAuth } from "../../lib/auth-context";

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
          <p className="text-zinc-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden">
      {/* Dynamic Background Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-500/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-zinc-800/50 bg-zinc-950/90 backdrop-blur-md">
        <div className="flex h-full items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-400">
                <Shield className="h-5 w-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Secure<span className="text-zinc-100">Wallet</span>
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
                      ? "bg-zinc-800 text-white shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
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
                    className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-400">
                      <User className="h-4 w-4 text-black" />
                    </div>
                    <span className="text-sm font-medium text-white max-w-[120px] truncate">
                      {user.username}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-zinc-900 border-zinc-800"
                >
                  <DropdownMenuLabel className="text-zinc-300">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-white">{user.username}</p>
                      <p className="text-xs text-zinc-400">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  {user.wallet_address && (
                    <>
                      <DropdownMenuItem className="text-zinc-300 focus:bg-zinc-800 focus:text-white">
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-400">Wallet</span>
                          <span className="text-xs font-mono">
                            {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-white hover:bg-white/10 focus:bg-white/20 focus:text-white cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" className="text-zinc-400 hover:text-white">
                    Đăng nhập
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="bg-zinc-100 text-black hover:bg-zinc-200">
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

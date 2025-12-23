"use client";

import Link from "next/link";
import {
  Wallet,
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
  return (
    <div className="min-h-screen bg-cyber-bg-dark">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-cyber-border bg-cyber-bg-darker/95 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-neon-cyan to-cyber-neon-purple">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-cyber-text-primary">
                  Secure<span className="text-cyber-neon-cyan">Wallet</span>
                </h1>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            <Link href="/user/exchange">
              <Button variant="ghost" className="gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                Exchange
              </Button>
            </Link>
          </nav>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-cyber-text-primary">
                Demo User
              </p>
              <p className="text-xs text-cyber-text-muted">Connected</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyber-bg-elevated border border-cyber-border">
              <User className="h-5 w-5 text-cyber-text-secondary" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <div className="min-h-[calc(100vh-4rem)]">{children}</div>
      </main>
    </div>
  );
}

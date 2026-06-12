"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield, ArrowRight, Activity, Globe } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export default function DemoLandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // If already logged in, skip the landing page and go straight to exchange
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/user/exchange");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080a]">
        <div className="text-slate-400">Loading demo environment...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08080a] text-slate-100 selection:bg-teal-500/30">
      <main className="flex flex-1 flex-col items-center justify-center px-6 relative overflow-hidden">
        
        {/* Background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="z-10 flex flex-col items-center text-center max-w-3xl">
          {/* Logo/Icon */}
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-400 via-slate-100 to-amber-300 shadow-[0_0_80px_rgba(20,184,166,0.3)]">
            <Shield className="h-12 w-12 text-slate-950" />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300 mb-6">
            <Activity className="h-3.5 w-3.5" />
            Interactive Demo Environment
          </div>

          <h1 className="mb-6 text-5xl font-extrabold tracking-tight md:text-7xl">
            Experience the <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-amber-300">Security</span>
          </h1>
          
          <p className="mb-10 max-w-2xl text-lg text-slate-400 md:text-xl leading-relaxed">
            Welcome to the Blockchain AI Sentinel simulator. Access the user portal to simulate cross-chain transfers, trigger real-time AI risk analysis, and watch the system block fraudulent transactions instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button
              size="lg"
              onClick={() => router.push("/login")}
              className="h-14 px-8 text-base font-semibold bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl transition-all hover:scale-105 shadow-[0_0_40px_rgba(20,184,166,0.4)]"
            >
              Enter User Portal
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full z-10">
          {[
            { title: "Real-time AI", desc: "Transactions are analyzed in milliseconds." },
            { title: "Multi-Chain", desc: "Simulate Ethereum and BSC network traffic." },
            { title: "FATF Compliant", desc: "Detects structuring and wash trading patterns." }
          ].map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
              <h3 className="text-white font-medium mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}



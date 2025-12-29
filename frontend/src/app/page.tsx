import Link from "next/link";
import {
  Shield,
  UserCircle,
  Settings,
  ArrowRight,
  Zap,
  Eye,
  Lock,
  Activity,
  Fingerprint,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* Background Effects - Subtle gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Blockchain <span className="text-cyan-400">AI</span>{" "}
                Security
              </h1>
              <p className="text-sm text-slate-400">
                Multi-Agent Detection System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-emerald-400 font-medium">
                System Online
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-6xl w-full">
            {/* Hero Text */}
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6">
                <span className="text-cyan-400">AI-Powered</span> Blockchain
                <br />
                Security Platform
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Advanced multi-agent detection system for identifying money
                laundering, market manipulation, and fraud patterns in
                real-time.
              </p>
            </div>

            {/* Feature Icons Row */}
            <div className="flex justify-center gap-8 mb-16">
              {[
                { icon: Eye, label: "Real-time Detection" },
                { icon: Network, label: "Network Analysis" },
                { icon: Fingerprint, label: "Pattern Recognition" },
                { icon: Lock, label: "Secure Transfers" },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 text-slate-400"
                >
                  <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                    <feature.icon className="h-6 w-6 text-cyan-400" />
                  </div>
                  <span className="text-xs">{feature.label}</span>
                </div>
              ))}
            </div>

            {/* Two Main Cards */}
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* User Demo Card */}
              <Link href="/user/exchange" className="group">
                <div className="relative h-full">
                  {/* Card Content */}
                  <div className="relative h-full bg-slate-800 rounded-2xl p-8 border border-slate-700 group-hover:border-cyan-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]">
                    {/* Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 mb-6">
                      <UserCircle className="h-8 w-8 text-cyan-400" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-cyan-400 transition-colors">
                      User Demo
                    </h3>

                    {/* Description */}
                    <p className="text-slate-400 mb-6">
                      Experience the secure wallet interface. Transfer assets
                      with real-time risk detection and protection against
                      fraudulent addresses.
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {[
                        "Protected transfers with risk scoring",
                        "Real-time fraud detection",
                        "3-strike warning system",
                        "Secure banking-style UI",
                      ].map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-slate-400"
                        >
                          <Zap className="h-4 w-4 text-cyan-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700">
                      Enter User Portal
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Link>

              {/* Admin System Card */}
              <Link href="/admin/dashboard" className="group">
                <div className="relative h-full">
                  {/* Card Content */}
                  <div className="relative h-full bg-slate-800 rounded-2xl p-8 border border-slate-700 group-hover:border-red-500/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.25)]">
                    {/* Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/30 mb-6">
                      <Settings className="h-8 w-8 text-red-400" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-red-400 transition-colors">
                      Admin System
                    </h3>

                    {/* Description */}
                    <p className="text-slate-400 mb-6">
                      Access the security dashboard. Monitor AI detection
                      modules, manage suspicious accounts, and review blocked
                      transactions.
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {[
                        "AI Module Dashboard (3 agents)",
                        "Suspicious account network view",
                        "Account status management",
                        "Transaction history & analytics",
                      ].map((feature, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-slate-400"
                        >
                          <Activity className="h-4 w-4 text-red-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <Button className="w-full bg-red-600 hover:bg-red-700">
                      Enter Admin Panel
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center">
          <p className="text-sm text-slate-400">
            Multi-Agent AI Detection System • Real-time Blockchain Security
          </p>
        </footer>
      </div>
    </div>
  );
}

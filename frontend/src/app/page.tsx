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
    <div className="min-h-screen bg-cyber-bg-dark cyber-grid-bg relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyber-neon-cyan/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyber-neon-purple/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyber-neon-blue/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyber-neon-cyan to-cyber-neon-blue shadow-neon-cyan">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-cyber-text-primary">
                Blockchain <span className="text-cyber-neon-cyan">AI</span>{" "}
                Security
              </h1>
              <p className="text-sm text-cyber-text-muted">
                Multi-Agent Detection System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-cyber-neon-green/10 border border-cyber-neon-green/30 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-neon-green opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-neon-green"></span>
              </span>
              <span className="text-sm text-cyber-neon-green font-medium">
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
              <h2 className="text-5xl md:text-6xl font-bold text-cyber-text-primary mb-6">
                <span className="text-glow-cyan">AI-Powered</span> Blockchain
                <br />
                Security Platform
              </h2>
              <p className="text-xl text-cyber-text-secondary max-w-2xl mx-auto">
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
                  className="flex flex-col items-center gap-2 text-cyber-text-muted"
                >
                  <div className="p-3 rounded-lg bg-cyber-bg-card border border-cyber-border">
                    <feature.icon className="h-6 w-6 text-cyber-neon-cyan" />
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
                  {/* Animated Border */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyber-neon-cyan via-cyber-neon-blue to-cyber-neon-purple rounded-2xl opacity-50 group-hover:opacity-100 blur transition-all duration-500 group-hover:blur-md animate-border-glow" />

                  {/* Card Content */}
                  <div className="relative h-full bg-cyber-bg-card rounded-2xl p-8 border border-cyber-border group-hover:border-cyber-neon-cyan/50 transition-all duration-300">
                    {/* Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyber-neon-cyan/20 to-cyber-neon-blue/20 border border-cyber-neon-cyan/30 mb-6 group-hover:shadow-neon-cyan transition-all duration-300">
                      <UserCircle className="h-8 w-8 text-cyber-neon-cyan" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold text-cyber-text-primary mb-3 group-hover:text-cyber-neon-cyan transition-colors">
                      User Demo
                    </h3>

                    {/* Description */}
                    <p className="text-cyber-text-secondary mb-6">
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
                          className="flex items-center gap-2 text-sm text-cyber-text-muted"
                        >
                          <Zap className="h-4 w-4 text-cyber-neon-cyan" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <Button
                      variant="neon"
                      className="w-full group-hover:bg-cyber-neon-cyan/10"
                    >
                      Enter User Portal
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Link>

              {/* Admin System Card */}
              <Link href="/admin/dashboard" className="group">
                <div className="relative h-full">
                  {/* Animated Border */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyber-neon-red via-cyber-neon-orange to-cyber-neon-yellow rounded-2xl opacity-50 group-hover:opacity-100 blur transition-all duration-500 group-hover:blur-md" />

                  {/* Card Content */}
                  <div className="relative h-full bg-cyber-bg-card rounded-2xl p-8 border border-cyber-border group-hover:border-cyber-neon-orange/50 transition-all duration-300">
                    {/* Icon */}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-cyber-neon-red/20 to-cyber-neon-orange/20 border border-cyber-neon-orange/30 mb-6 group-hover:shadow-neon-orange transition-all duration-300">
                      <Settings className="h-8 w-8 text-cyber-neon-orange" />
                    </div>

                    {/* Title */}
                    <h3 className="text-2xl font-bold text-cyber-text-primary mb-3 group-hover:text-cyber-neon-orange transition-colors">
                      Admin System
                    </h3>

                    {/* Description */}
                    <p className="text-cyber-text-secondary mb-6">
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
                          className="flex items-center gap-2 text-sm text-cyber-text-muted"
                        >
                          <Activity className="h-4 w-4 text-cyber-neon-orange" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Button */}
                    <Button
                      variant="neon-red"
                      className="w-full group-hover:bg-cyber-neon-red/10 border-cyber-neon-orange text-cyber-neon-orange hover:border-cyber-neon-orange hover:shadow-neon-orange"
                    >
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
          <p className="text-sm text-cyber-text-muted">
            Multi-Agent AI Detection System • Real-time Blockchain Security
          </p>
        </footer>
      </div>
    </div>
  );
}

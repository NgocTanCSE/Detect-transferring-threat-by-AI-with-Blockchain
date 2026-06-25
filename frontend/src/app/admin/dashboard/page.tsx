import { Suspense } from "react";
import Link from "next/link";
import LiveDashboard from "@/components/live-dashboard";

function DashboardFallback() {
  return (
    <div className="min-h-screen bg-[#08080a] p-6 text-slate-300">
      Loading dashboard...
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <div className="fixed top-4 right-4 z-50">
        <Link href="/user/exchange">
          <button className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all">
            User Test - Chuyển Coin
          </button>
        </Link>
      </div>
      <LiveDashboard />
    </Suspense>
  );
}

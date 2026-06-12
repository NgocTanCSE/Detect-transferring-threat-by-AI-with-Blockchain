import { Suspense } from "react";
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
      <LiveDashboard />
    </Suspense>
  );
}


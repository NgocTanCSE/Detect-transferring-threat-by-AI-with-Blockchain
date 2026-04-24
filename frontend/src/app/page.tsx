import { Suspense } from "react";
import LiveDashboard from "@/components/live-dashboard";

function DashboardFallback() {
  return (
    <div className="min-h-screen bg-[#050816] p-6 text-zinc-300">
      Loading dashboard...
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <LiveDashboard />
    </Suspense>
  );
}

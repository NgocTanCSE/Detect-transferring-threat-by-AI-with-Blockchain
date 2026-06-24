"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function LogVolumeTrend({ logs }: { logs: any[] }) {
  const data = useMemo(() => {
    const minuteCounts: Record<string, number> = {};
    // Get last 15 minutes of activity
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      const key = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      minuteCounts[key] = 0;
    }

    logs.forEach(log => {
      const key = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (minuteCounts[key] !== undefined) minuteCounts[key]++;
    });

    return Object.entries(minuteCounts).map(([time, count]) => ({ time, count }));
  }, [logs]);

  return (
    <div className="h-[120px] w-full mb-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <Tooltip 
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
            labelStyle={{ color: "#94a3b8", fontSize: 10 }}
          />
          <Bar dataKey="count" fill="#2dd4bf" radius={[4, 4, 0, 0]} opacity={0.6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

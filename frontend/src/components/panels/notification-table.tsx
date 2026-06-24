"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotificationItem } from "../dashboard-utils";
import {
  EmptyState,
  TablePager,
  SeverityPill,
} from "../dashboard-utils";

export default function NotificationTable({ notifications }: { notifications: NotificationItem[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const pageSizeOptions = [8, 20, 50];

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const pagedNotifications = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return notifications.slice(startIndex, startIndex + pageSize);
  }, [notifications, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!notifications.length) {
    return <EmptyState message="No notification events have been recorded yet." />;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-700">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Channel</th>
              <th className="px-4 py-3 text-left font-medium">Recipient</th>
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
            {pagedNotifications.map((notification) => (
              <tr key={notification.id}>
                <td className="px-4 py-3">{notification.channel}</td>
                <td className="px-4 py-3">{notification.recipient}</td>
                <td className="px-4 py-3"><SeverityPill severity={notification.severity} /></td>
                <td className="px-4 py-3">{notification.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePager
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
        itemCount={notifications.length}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}

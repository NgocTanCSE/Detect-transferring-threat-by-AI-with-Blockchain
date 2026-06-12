"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export default function UserPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/user/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080a]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
        <p className="text-slate-400">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function UserPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/user/dashboard");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080a]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
        <p className="text-slate-400">Đang chuyển hướng...</p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldOff } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 mb-4 shadow-lg shadow-cyan-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Blockchain Sentinel</h1>
          <p className="text-slate-400 mt-1">AI-Powered Risk Detection</p>
        </div>

        <Card className="glass-card gradient-border animate-slide-up stagger-1">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Đăng nhập tạm ngưng</CardTitle>
            <CardDescription className="text-slate-400">
              Hệ thống đang chạy ở chế độ không dùng tài khoản để test luồng Alchemy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
              <ShieldOff className="h-5 w-5 mt-0.5" />
              <p className="text-sm">
                Tạm thời đã tắt đăng nhập và đăng ký để tập trung vận hành pipeline phân tích giao dịch real-time.
              </p>
            </div>

            <Link href="/user/exchange" className="block">
              <Button className="w-full btn-glow bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium">
                Đi đến khu vực người dùng
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6 animate-fade-in stagger-2">
          Bảo vệ giao dịch crypto của bạn với AI thế hệ mới
        </p>
      </div>
    </div>
  );
}

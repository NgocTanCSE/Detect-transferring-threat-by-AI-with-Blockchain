"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ShieldOff } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg shadow-purple-500/25">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Đăng ký tạm ngưng</h1>
          <p className="text-slate-400 mt-1">Hệ thống đang vận hành ở chế độ không cần tài khoản.</p>
        </div>

        <Card className="glass-card gradient-border animate-slide-up stagger-1">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Tạm thời vô hiệu hóa</CardTitle>
            <CardDescription className="text-slate-400">
              Đăng ký sẽ được bật lại sau khi hoàn tất đại tu kiến trúc role mới.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
              <ShieldOff className="h-5 w-5 mt-0.5" />
              <p className="text-sm">
                Đăng ký đang tạm ngưng để ưu tiên vận hành luồng phân tích giao dịch trực tiếp từ Alchemy.
              </p>
            </div>

            <Link href="/" className="block">
              <Button className="w-full btn-glow bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-medium">
                Quay về trang chủ
              </Button>
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-xs mt-6 animate-fade-in stagger-2">
          Bằng việc đăng ký, bạn đồng ý với điều khoản sử dụng
        </p>
      </div>
    </div>
  );
}

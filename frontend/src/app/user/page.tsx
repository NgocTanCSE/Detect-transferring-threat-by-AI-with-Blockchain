"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Shield, Wallet, Mail, User as UserIcon, ArrowRight } from "lucide-react";

export default function UserPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Đang tải...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20 pb-12">
      <div className="mx-auto max-w-4xl px-4">
        {/* Profile Card */}
        <Card className="mb-6 border-slate-700/70 bg-slate-950/80 backdrop-blur">
          <CardHeader className="border-b border-slate-700/50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                  <UserIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-white">{user.username}</CardTitle>
                  <CardDescription className="mt-1 text-slate-400">
                    Tài khoản người dùng • {new Date(user.created_at).toLocaleDateString("vi-VN")}
                  </CardDescription>
                </div>
              </div>
              <div className="rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
                {user.role === "admin" ? "Admin" : "User"}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-slate-800/50 p-2">
                  <Mail className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Địa chỉ email</p>
                  <p className="text-base font-medium text-white break-all">{user.email}</p>
                </div>
              </div>

              {/* Wallet Address */}
              {user.wallet_address ? (
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-lg bg-slate-800/50 p-2">
                    <Wallet className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="w-full">
                    <p className="text-sm text-slate-400">Địa chỉ ví</p>
                    <p className="text-base font-mono text-white break-all">
                      {user.wallet_address}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="mt-1 rounded-lg bg-slate-800/50 p-2">
                    <Wallet className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Địa chỉ ví</p>
                    <p className="text-base text-slate-500">Chưa liên kết ví</p>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-slate-800/50 p-2">
                  <Shield className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Trạng thái tài khoản</p>
                  <p className="text-base font-medium text-white">
                    {user.is_active ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        Hoạt động
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
                        Bị vô hiệu hóa
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Warning Count */}
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-slate-800/50 p-2">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Cảnh báo</p>
                  <p className="text-base font-medium text-white">{user.warning_count} cảnh báo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-slate-700/70 bg-slate-950/80 backdrop-blur hover:border-cyan-500/50 transition cursor-pointer">
            <CardHeader
              onClick={() => router.push("/user/exchange")}
              className="pb-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-white">Giao dịch</CardTitle>
                  <CardDescription className="mt-1">
                    Xem và quản lý giao dịch ví của bạn
                  </CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
          </Card>

          <Card className="border-slate-700/70 bg-slate-950/80 backdrop-blur hover:border-cyan-500/50 transition cursor-pointer">
            <CardHeader
              onClick={() => router.push("/user/history")}
              className="pb-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-white">Lịch sử</CardTitle>
                  <CardDescription className="mt-1">
                    Xem lịch sử hoạt động của tài khoản
                  </CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Info Section */}
        <Card className="mt-6 border-slate-700/70 bg-slate-950/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Thông tin hệ thống</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>ID tài khoản:</span>
                <span className="font-mono text-slate-300">{user.id}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Ngày tạo:</span>
                <span className="text-slate-300">
                  {new Date(user.created_at).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper for AlertTriangle icon that wasn't imported
import { AlertTriangle } from "lucide-react";

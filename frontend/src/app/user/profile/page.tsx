"use client";

import { useState } from "react";
import {
  User,
  Mail,
  Shield,
  Wallet,
  Copy,
  Check,
  Bell,
  Lock,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatAddress } from "@/lib/utils";

export default function UserProfile() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  });

  const copyAddress = () => {
    if (user?.wallet_address) {
      navigator.clipboard.writeText(user.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Hồ Sơ Cá Nhân</h1>
        <p className="text-slate-400 mt-1">Quản lý thông tin tài khoản</p>
      </div>

      {/* Profile Card */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600">
              <User className="h-10 w-10 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{user?.username || "User"}</h2>
              <p className="text-slate-400 mt-1">{user?.email || "N/A"}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="border-teal-500/30 text-teal-400">
                  {user?.role === "admin" ? "Admin" : user?.role === "analyst" ? "Analyst" : "User"}
                </Badge>
                <Badge variant="outline" className="border-slate-700 text-slate-400">
                  Active
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet Address */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-teal-400" />
            Địa Chỉ Ví
          </CardTitle>
          <CardDescription className="text-slate-400">
            Địa chỉ ví blockchain được liên kết với tài khoản
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
            <p className="flex-1 font-mono text-sm text-slate-300 break-all">
              {user?.wallet_address || "Chưa liên kết"}
            </p>
            {user?.wallet_address && (
              <Button
                variant="ghost"
                size="icon"
                onClick={copyAddress}
                className="text-slate-400 hover:text-teal-400 shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-400" />
            Thông Tin Tài Khoản
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Tên Đăng Nhập</Label>
              <Input
                value={user?.username || ""}
                disabled
                className="bg-slate-900/50 border-slate-800 text-slate-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-slate-900/50 border-slate-800 text-slate-300"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-slate-400" />
            Cài Đặt Thông Báo
          </CardTitle>
          <CardDescription className="text-slate-400">
            Chọn cách nhận thông báo từ hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "email" as const, label: "Email", desc: "Nhận cảnh báo qua email", icon: Mail },
            { key: "push" as const, label: "Push Notification", desc: "Thông báo trên trình duyệt", icon: Bell },
            { key: "sms" as const, label: "SMS", desc: "Nhận tin nhắn SMS", icon: Globe },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-800/30"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() =>
                  setNotifications((prev) => ({
                    ...prev,
                    [item.key]: !prev[item.key],
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  notifications[item.key] ? "bg-teal-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    notifications[item.key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-[#0f0f16] border-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-400" />
            Bảo Mật
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-slate-800/30">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-teal-400" />
              <div>
                <p className="text-sm font-medium text-white">Đăng Nhập Cuối</p>
                <p className="text-xs text-slate-500">Phiên đăng nhập hiện tại</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">Active now</span>
          </div>
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            Đổi Mật Khẩu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

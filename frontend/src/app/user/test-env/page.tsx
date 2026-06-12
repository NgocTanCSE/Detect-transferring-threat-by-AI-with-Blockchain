"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TestTube,
  Users,
  ArrowLeftRight,
  Shield,
  RefreshCw,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

interface TestUser {
  id: string;
  username: string;
  email: string;
  role: "user" | "analyst" | "admin";
  wallet_address: string;
  status: "active" | "idle" | "blocked";
  lastAction: string;
  riskLevel: "low" | "medium" | "high";
}

const TEST_USERS: TestUser[] = [
  {
    id: "user-001",
    username: "alice_trader",
    email: "alice@example.com",
    role: "user",
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    status: "active",
    lastAction: "Gửi 2.5 ETH",
    riskLevel: "low",
  },
  {
    id: "user-002",
    username: "bob_analyst",
    email: "bob@example.com",
    role: "analyst",
    wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
    status: "active",
    lastAction: "Phân tích cảnh báo #1234",
    riskLevel: "low",
  },
  {
    id: "user-003",
    username: "charlie_whale",
    email: "charlie@example.com",
    role: "user",
    wallet_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    status: "active",
    lastAction: "Nhận 100 ETH",
    riskLevel: "medium",
  },
  {
    id: "user-004",
    username: "dave_suspicious",
    email: "dave@example.com",
    role: "user",
    wallet_address: "0x9876543210fedcba9876543210fedcba98765432",
    status: "blocked",
    lastAction: "Chuyển 50 ETH đến mixer",
    riskLevel: "high",
  },
  {
    id: "user-005",
    username: "eve_compliance",
    email: "eve@example.com",
    role: "admin",
    wallet_address: "0xfedcba9876543210fedcba9876543210fedcba98",
    status: "active",
    lastAction: "Xác nhận fraud case #567",
    riskLevel: "low",
  },
];

interface TestLog {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  type: "success" | "warning" | "error" | "info";
}

export default function TestEnvironment() {
  const { user, login, logout } = useAuth();
  const [selectedUser, setSelectedUser] = useState<TestUser | null>(null);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);
  const [stats, setStats] = useState({
    totalActions: 0,
    blockedActions: 0,
    warnings: 0,
  });

  const addLog = useCallback((action: string, type: TestLog["type"], userId: string) => {
    const newLog: TestLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId,
      action,
      type,
    };
    setLogs((prev) => [newLog, ...prev].slice(0, 50));
    setStats((prev) => ({
      ...prev,
      totalActions: prev.totalActions + 1,
      blockedActions: prev.blockedActions + (type === "error" ? 1 : 0),
      warnings: prev.warnings + (type === "warning" ? 1 : 0),
    }));
  }, []);

  const simulateAction = useCallback(
    (testUser: TestUser) => {
      const actions = [
        {
          action: `Gửi ${(Math.random() * 10).toFixed(2)} ETH`,
          type: testUser.riskLevel === "high" ? ("error" as const) : ("success" as const),
        },
        {
          action: "Kiểm tra số dư ví",
          type: "info" as const,
        },
        {
          action: "Xem lịch sử giao dịch",
          type: "info" as const,
        },
        {
          action: `Phân tích rủi ro địa chỉ mới`,
          type: testUser.riskLevel === "medium" ? ("warning" as const) : ("info" as const),
        },
        {
          action: "Nhận cảnh báo bảo mật",
          type: testUser.status === "blocked" ? ("error" as const) : ("warning" as const),
        },
      ];

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      addLog(`${testUser.username}: ${randomAction.action}`, randomAction.type, testUser.id);
    },
    [addLog]
  );

  // Auto-run simulation
  useEffect(() => {
    if (!isAutoRunning || !selectedUser) return;

    const interval = setInterval(() => {
      simulateAction(selectedUser);
    }, 2000);

    return () => clearInterval(interval);
  }, [isAutoRunning, selectedUser, simulateAction]);

  const switchToUser = async (testUser: TestUser) => {
    setSelectedUser(testUser);
    addLog(`Chuyển sang user: ${testUser.username}`, "info", testUser.id);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-teal-500/20 text-teal-400 border-teal-500/30";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "blocked":
        return "bg-red-500/20 text-red-400";
      case "active":
        return "bg-teal-500/20 text-teal-400";
      default:
        return "bg-slate-500/20 text-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TestTube className="h-6 w-6 text-amber-400" />
            Test Environment
          </h1>
          <p className="text-slate-400 mt-1">
            Môi trường thử nghiệm với nhiều user khác nhau
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isAutoRunning ? "destructive" : "default"}
            onClick={() => setIsAutoRunning(!isAutoRunning)}
            disabled={!selectedUser}
            className={isAutoRunning ? "bg-red-500 hover:bg-red-600" : "bg-teal-500 hover:bg-teal-400 text-slate-950"}
          >
            {isAutoRunning ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Dừng
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Tự Động
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tổng Hành Động", value: stats.totalActions, icon: Zap, color: "text-blue-400" },
          { label: "Bị Chặn", value: stats.blockedActions, icon: AlertTriangle, color: "text-red-400" },
          { label: "Cảnh Báo", value: stats.warnings, icon: Shield, color: "text-amber-400" },
        ].map((stat, i) => (
          <Card key={i} className="bg-[#0f0f16] border-slate-800/50">
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <div>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="text-xl font-bold text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User List */}
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-teal-400" />
              Danh Sách User Thử Nghiệm
            </CardTitle>
            <CardDescription className="text-slate-400">
              Chọn user để mô phỏng hành động
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TEST_USERS.map((testUser) => (
              <div
                key={testUser.id}
                onClick={() => switchToUser(testUser)}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedUser?.id === testUser.id
                    ? "bg-teal-500/10 border-teal-500/30"
                    : "bg-slate-900/30 border-slate-800/30 hover:border-slate-700/50"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800">
                  <span className="text-lg font-bold text-white">
                    {testUser.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{testUser.username}</p>
                    <Badge variant="outline" className={`text-[10px] ${getStatusColor(testUser.status)}`}>
                      {testUser.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{testUser.email}</p>
                  <p className="text-xs text-slate-600 mt-0.5">Vai trò: {testUser.role}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] ${getRiskColor(testUser.riskLevel)}`}>
                  Risk: {testUser.riskLevel}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Activity Log */}
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-400" />
              Nhật Ký Hoạt Động
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <TestTube className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Chọn user và bắt đầu mô phỏng</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/30 border border-slate-800/20"
                  >
                    <div
                      className={`mt-0.5 p-1 rounded ${
                        log.type === "success"
                          ? "bg-teal-500/20"
                          : log.type === "warning"
                          ? "bg-amber-500/20"
                          : log.type === "error"
                          ? "bg-red-500/20"
                          : "bg-slate-500/20"
                      }`}
                    >
                      {log.type === "success" ? (
                        <CheckCircle2 className="h-3 w-3 text-teal-400" />
                      ) : log.type === "warning" ? (
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                      ) : log.type === "error" ? (
                        <AlertTriangle className="h-3 w-3 text-red-400" />
                      ) : (
                        <Zap className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-slate-300">{log.action}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {selectedUser && (
        <Card className="bg-[#0f0f16] border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Hành Động Nhanh - {selectedUser.username}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Gửi ETH", action: `Gửi ${(Math.random() * 5).toFixed(2)} ETH`, type: "success" as const },
                { label: "Kiểm Tra Ví", action: "Kiểm tra số dư ví", type: "info" as const },
                { label: "Phân Tích Rủi Ro", action: "Phân tích rủi ro địa chỉ", type: "warning" as const },
                { label: "Xem Lịch Sử", action: "Xem lịch sử giao dịch", type: "info" as const },
              ].map((btn, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 h-12"
                  onClick={() => addLog(`${selectedUser.username}: ${btn.action}`, btn.type, selectedUser.id)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

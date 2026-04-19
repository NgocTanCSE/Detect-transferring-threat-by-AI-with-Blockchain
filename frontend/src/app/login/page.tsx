"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/api-auth";
import { useAuth } from "@/lib/auth-context";

function resolveFriendlyError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("temporarily disabled")) return "Tính năng đăng nhập đang tạm tắt trên backend. Bạn có thể vào khu vực user để tiếp tục thao tác.";
  if (lower.includes("incorrect username or password")) return "Sai tài khoản hoặc mật khẩu.";
  if (lower.includes("failed to fetch")) return "Không kết nối được backend. Hãy kiểm tra docker compose đang chạy.";
  return errorMessage;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => username.trim().length > 0 && password.length >= 6, [username, password]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const auth = await login({ username: username.trim(), password });
      const currentUser = await getCurrentUser(auth.access_token);

      if (currentUser.role === "admin") {
        router.push("/?role=system_admin&feature=0");
      } else {
        router.push("/user/exchange");
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Đăng nhập thất bại";
      setError(resolveFriendlyError(rawMessage));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Blockchain Sentinel</h1>
            <p className="mt-1 text-slate-400">Đăng nhập hệ thống giám sát</p>
          </div>

          <Card className="border-slate-700/70 bg-slate-900/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Đăng nhập</CardTitle>
              <CardDescription className="text-slate-400">Dùng username hoặc email đã đăng ký.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">Username / Email</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="vd: ngoc.tan"
                    autoComplete="username"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
                ) : null}

                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang đăng nhập...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Đăng nhập
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-4 flex flex-col gap-2 text-sm text-slate-400">
                <p>
                  Chưa có tài khoản?{" "}
                  <Link href="/register" className="text-cyan-400 hover:text-cyan-300">
                    Tạo tài khoản
                  </Link>
                </p>
                <p>
                  Hoặc vào nhanh{" "}
                  <Link href="/user/exchange" className="text-cyan-400 hover:text-cyan-300">
                    khu vực user
                  </Link>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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

function isAdminRole(role?: string | null): boolean {
  const normalized = (role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "system_admin";
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

      if (isAdminRole(currentUser.role)) {
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
    <div className="min-h-screen bg-[#08080a] p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-500 shadow-lg shadow-white/10">
              <Shield className="h-7 w-7 text-zinc-950" />
            </div>
            <h1 className="text-2xl font-bold text-white">Blockchain Sentinel</h1>
            <p className="mt-1 text-zinc-400">Đăng nhập hệ thống giám sát</p>
          </div>

          <Card className="border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">Đăng nhập</CardTitle>
              <CardDescription className="text-zinc-400">Dùng username hoặc email đã đăng ký.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-zinc-300">Username / Email</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Tên đăng nhập hoặc email"
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-zinc-300">Mật khẩu</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Tối thiểu 6 ký tự"
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-white/40"
                  />
                  <p className="text-[11px] text-zinc-500">Mật khẩu phải có ít nhất 6 ký tự.</p>
                </div>

                {error ? (
                  <div className="rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">{error}</div>
                ) : null}

                <Button type="submit" className="w-full bg-white text-zinc-950 hover:bg-zinc-200 transition-colors" disabled={!canSubmit || isSubmitting}>
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

              <div className="mt-4 flex flex-col gap-3 text-sm text-zinc-400">
                <p>
                  Chưa có tài khoản?{" "}
                  <Link href="/register" className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:decoration-white transition-all">
                    Tạo tài khoản
                  </Link>
                </p>
                <p>
                  Hoặc vào nhanh{" "}
                  <Link href="/user/exchange" className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:decoration-white transition-all">
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

"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Shield, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/lib/api-auth";

function resolveFriendlyError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("temporarily disabled")) return "Đăng ký đang tạm tắt ở backend. Bạn vẫn có thể vào khu vực user để dùng hệ thống.";
  if (lower.includes("already registered")) return "Tên tài khoản hoặc email đã tồn tại.";
  if (lower.includes("failed to fetch")) return "Không kết nối được backend. Hãy kiểm tra docker compose đang chạy.";
  return errorMessage;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return username.trim().length >= 3 && email.trim().length > 0 && password.length >= 6;
  }, [email, password, username]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const registeredUser = await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });

      setSuccess(`Đăng ký thành công. Đang chuyển sang trang đăng nhập...`);
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Đăng ký thất bại";
      setError(resolveFriendlyError(rawMessage));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 relative overflow-hidden p-4">
      {/* Dynamic Background Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-500/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto relative z-10 flex min-h-screen w-full max-w-lg items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-500 shadow-lg shadow-white/10">
              <Shield className="h-7 w-7 text-zinc-950" />
            </div>
            <h1 className="text-2xl font-bold text-white">Tạo tài khoản</h1>
            <p className="mt-1 text-zinc-400">Đăng ký để theo dõi và bảo vệ giao dịch.</p>
          </div>

          <Card className="border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">Đăng ký</CardTitle>
              <CardDescription className="text-zinc-400">Thông tin cơ bản để tạo tài khoản mới.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-zinc-300">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Tối thiểu 3 ký tự"
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-white/40"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
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
                    placeholder="Tối thiểu 6 ký tự"
                    className="border-zinc-800 bg-zinc-950 text-zinc-100 focus:border-white/40"
                  />
                </div>



                {error ? (
                  <div className="rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">{error}</div>
                ) : null}

                {success ? (
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </div>
                ) : null}

                <Button type="submit" className="w-full bg-white text-zinc-950 hover:bg-zinc-200 transition-colors" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tạo tài khoản...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Tạo tài khoản
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-4 text-sm text-zinc-400">
                Đã có tài khoản?{" "}
                <Link href="/login" className="text-zinc-100 underline decoration-zinc-700 underline-offset-4 hover:decoration-white transition-all">
                  Đăng nhập ngay
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



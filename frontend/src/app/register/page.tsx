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
  if (lower.includes("wallet address is required")) return "Bạn cần nhập wallet address để tạo tài khoản user.";
  if (lower.includes("wallet must already be linked")) return "Wallet phải đã có dữ liệu trong hệ thống (wallet/transactions/alerts/blocked) trước khi đăng ký.";
  if (lower.includes("failed to fetch")) return "Không kết nối được backend. Hãy kiểm tra docker compose đang chạy.";
  return errorMessage;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const hasBasic = username.trim().length >= 3 && email.trim().length > 0 && password.length >= 6;
    const hasValidWallet = walletAddress.trim().length === 42 && walletAddress.startsWith("0x");
    return hasBasic && hasValidWallet;
  }, [email, password, username, walletAddress]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
        wallet_address: walletAddress.trim(),
      });

      setSuccess("Đăng ký thành công. Đang chuyển sang trang đăng nhập...");
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
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="mx-auto flex min-h-screen w-full max-w-lg items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Tạo tài khoản</h1>
            <p className="mt-1 text-slate-400">Đăng ký để theo dõi và bảo vệ giao dịch.</p>
          </div>

          <Card className="border-slate-700/70 bg-slate-900/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Đăng ký</CardTitle>
              <CardDescription className="text-slate-400">Thông tin cơ bản để tạo tài khoản mới.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-slate-300">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Tối thiểu 3 ký tự"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
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
                    placeholder="Tối thiểu 6 ký tự"
                    className="border-slate-700 bg-slate-950 text-slate-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wallet" className="text-slate-300">Wallet address</Label>
                  <Input
                    id="wallet"
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value)}
                    placeholder="0x..."
                    className="border-slate-700 bg-slate-950 font-mono text-slate-100"
                  />
                  <p className="text-xs text-slate-400">
                    Wallet phải có liên kết dữ liệu sẵn trong hệ thống (wallet profile, transactions, alerts hoặc blocked transfers).
                  </p>
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
                ) : null}

                {success ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {success}
                  </div>
                ) : null}

                <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={!canSubmit || isSubmitting}>
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

              <p className="mt-4 text-sm text-slate-400">
                Đã có tài khoản?{" "}
                <Link href="/login" className="text-cyan-400 hover:text-cyan-300">
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

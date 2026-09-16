"use client";
// src/app/(auth)/login/page.tsx
// Compact & Professional Login Page with Plus Jakarta Sans & #a80063 Brand

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email dan password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        console.error("Login response error:", res);
        if (res.status === 401 || res.error === "CredentialsSignin") {
          toast.error("Email/Username atau password salah. Silakan periksa kembali.");
        } else {
          toast.error(`Gagal masuk (${res.error}). Silakan coba lagi.`);
        }
      } else {
        toast.success("Berhasil masuk!");
        window.location.href = callbackUrl;
      }
    } catch (err: any) {
      console.error("Login catch error:", err);
      toast.error("Terjadi kesalahan sistem. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-[#a80063]/10 to-[#c026d3]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-gradient-to-tr from-[#a80063]/10 to-[#3b82f6]/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#a80063] to-[#d946ef] flex items-center justify-center shadow-md shadow-[#a80063]/20 mx-auto mb-3">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
            CDU <span className="text-[#a80063]">PORTAL</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Sistem Monitoring Perkuliahan - Nusa Putra University
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] border border-slate-200/80">
          <div className="mb-5 text-left">
            <h2 className="text-sm font-bold text-slate-900">
              Selamat Datang 👋
            </h2>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              Masuk dengan akun staf CDU untuk mengakses sistem
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email / Username Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1" htmlFor="email">
                Email atau Username
              </label>
              <input
                id="email"
                type="text"
                placeholder="admin atau nama@nusaputra.ac.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                disabled={loading}
                className="w-full px-3.5 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-[#a80063] hover:bg-[#8c0052] text-white text-xs font-semibold rounded-lg shadow-sm shadow-[#a80063]/25 hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <LogIn size={14} />
                  <span>Masuk ke Sistem</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400 font-medium mt-5">
          Julhan A Malik - CDU © {new Date().getFullYear()} Nusa Putra University
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f8fb] flex items-center justify-center text-xs font-medium text-slate-400">Memuat Portal CDU...</div>}>
      <LoginForm />
    </Suspense>
  );
}

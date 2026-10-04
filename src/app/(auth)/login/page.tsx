"use client";
// src/app/(auth)/login/page.tsx
// Modern Split Layout Login Page inspired by Kezak Design System with CDU #a80063 Brand

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  GraduationCap,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  Mail,
  Lock,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Users,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  Phone,
  Building,
} from "lucide-react";

interface SlideData {
  id: number;
  badge: {
    icon: any;
    text: string;
  };
  headline: string;
  description: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    badge: {
      icon: GraduationCap,
      text: "Command Center CDU",
    },
    headline: "Pusat Kendali & Monitoring Perkuliahan Real-Time",
    description:
      "Pantau performa kehadiran dosen, kelengkapan 3 pilar konten pembelajaran, dan status perkuliahan harian dalam satu sistem komprehensif terpadu.",
  },
  {
    id: 2,
    badge: {
      icon: Users,
      text: "Akses Pimpinan Akademik",
    },
    headline: "Portal Pengawasan Kaprodi & Sekprodi",
    description:
      "Transparansi data perkuliahan untuk membantu pimpinan program studi mengevaluasi dosen, mendeteksi kendala sesi, dan membina mutu pengajaran secara terarah.",
  },
  {
    id: 3,
    badge: {
      icon: ShieldCheck,
      text: "Standar Penjaminan Mutu",
    },
    headline: "Standar Mutu Pembelajaran & Akreditasi Unggul",
    description:
      "Mendukung akreditasi program studi dengan target kehadiran minimal 90% serta kepatuhan RPS, bahan ajar, tugas, dan video konferensi interaktif.",
  },
];

function LoginForm() {
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get("callbackUrl");
  const callbackUrl =
    !rawCallback || rawCallback === "/login" || rawCallback.startsWith("/login")
      ? "/"
      : rawCallback;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Auto-advance slides every 6 seconds (pause on hover)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Email/Username dan password wajib diisi");
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
        toast.success("Berhasil masuk! Mengalihkan ke dashboard...");
        window.location.replace(callbackUrl);
      }
    } catch (err: any) {
      console.error("Login catch error:", err);
      toast.error("Terjadi kesalahan sistem. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const currentSlide = SLIDES[activeSlide];
  const BadgeIcon = currentSlide.badge.icon;

  return (
    <div className="min-h-screen bg-slate-100/80 flex items-center justify-center p-3 sm:p-5 lg:p-8 font-sans relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#a80063]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#d946ef]/10 blur-3xl pointer-events-none" />

      {/* Main Card Frame with Rounded Borders (Kezak Split Layout) */}
      <div className="w-full max-w-[1140px] bg-white rounded-3xl sm:rounded-[32px] shadow-[0_20px_60px_-15px_rgba(15,23,42,0.12)] border border-slate-200/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px] relative z-10">
        
        {/* ── LEFT PANEL: Form Area (Clean White) ─────────────────────────── */}
        <div className="lg:col-span-6 xl:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between bg-white relative">
          
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#a80063] to-[#d946ef] flex items-center justify-center shadow-sm shadow-[#a80063]/25 text-white">
              <GraduationCap size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold text-slate-900 tracking-tight leading-none">
                  CDU
                </span>
                <span className="text-base font-bold text-[#a80063] tracking-tight leading-none">
                  MONITORING
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block mt-0.5">
                Universitas Nusa Putra
              </span>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="my-auto py-8 max-w-sm sm:max-w-md w-full mx-auto">
            <div className="mb-6 text-left">
              <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-tight">
                Selamat Datang
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 font-normal mt-1.5 leading-relaxed">
                Silakan masuk dengan akun Anda untuk mengakses sistem monitoring dan evaluasi perkuliahan.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Field: Email atau Username */}
              <div>
                <label
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                  htmlFor="email"
                >
                  Email atau Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Mail size={16} />
                  </div>
                  <input
                    id="email"
                    type="text"
                    placeholder="admin atau nama@nusaputra.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/15 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div>
                <label
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                  htmlFor="password"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock size={16} />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password Anda"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/15 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#a80063] hover:bg-[#8e0054] active:bg-[#770046] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm shadow-[#a80063]/30 hover:shadow-md hover:shadow-[#a80063]/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Masuk ke Sistem</span>
                  </>
                )}
              </button>
            </form>

            {/* Subtle Divider & Help Option */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200/80" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white px-3 text-slate-400 font-medium">
                  Bantuan Akses
                </span>
              </div>
            </div>

            {/* Help Link Button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
            >
              <HelpCircle size={14} className="text-[#a80063]" />
              <span>Butuh bantuan atau lupa password? Hubungi Admin CDU</span>
            </button>
          </div>

          {/* Left Footer Info */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>Copyright CDU © {new Date().getFullYear()} Nusa Putra</span>
            <span className="hover:text-slate-600 transition-colors">
              Pusat Pengembangan Kurikulum & Pembelajaran
            </span>
          </div>
        </div>

        {/* ── RIGHT PANEL: Hero Showcase Slider (Deep Brand Gradient) ──────── */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="lg:col-span-6 xl:col-span-6 relative bg-gradient-to-br from-[#2a0019] via-[#48002a] to-[#18000f] p-6 sm:p-10 lg:p-12 flex flex-col justify-between overflow-hidden text-white min-h-[460px] lg:min-h-full"
        >
          {/* Subtle Grid Pattern Overlay (matching Kezak reference) */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0c_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0c_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

          {/* Glowing Radial Color Accents */}
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#a80063]/30 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[#d946ef]/20 blur-3xl pointer-events-none" />

          {/* ── TOP SECTION: Floating UI Mockup Cards ──────────────────────── */}
          <div className="relative z-10 w-full pt-2 pb-6 min-h-[290px] flex items-center justify-center">
            
            {/* SLIDE 1 MOCKUP: Donut Kehadiran & Skor 3 Pilar */}
            {activeSlide === 0 && (
              <div className="w-full max-w-[380px] relative animate-fade-in transition-all duration-500">
                {/* Card 1: Top Floating Card - Donut Kehadiran Dosen */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white ml-auto w-[82%] mb-3 hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <BarChart3 size={13} className="text-emerald-400" />
                      Evaluasi Kehadiran Dosen
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                      Target ≥90%
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    {/* Mini SVG Donut Chart */}
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 36 36">
                        <path
                          className="text-white/15"
                          strokeWidth="3.8"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-emerald-400"
                          strokeDasharray="88.1, 100"
                          strokeWidth="3.8"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[13px] font-extrabold leading-none">88.1%</span>
                        <span className="text-[8px] text-white/70">Hadir</span>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="space-y-1 text-[10px] flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-white/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          Hadir
                        </span>
                        <span className="font-bold text-emerald-300">1.274</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-white/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                          Alpha
                        </span>
                        <span className="font-bold text-rose-300">171</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-white/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Ganti Hari
                        </span>
                        <span className="font-bold text-amber-300">24</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Bottom Floating Card - Kelengkapan 3 Pilar */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white mr-auto w-[88%] hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-[#f472b6]" />
                      Kelengkapan Konten 3 Pilar
                    </span>
                    <span className="text-[10px] text-white/70 font-mono">1.382 Kelas</span>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[9.5px] text-white/80 mb-0.5">
                        <span>P1: RPS / Silabus</span>
                        <span className="font-bold text-emerald-300">94.2%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full" style={{ width: "94.2%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[9.5px] text-white/80 mb-0.5">
                        <span>P2: Bahan Ajar & Tugas/Kuis</span>
                        <span className="font-bold text-emerald-300">86.5%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full" style={{ width: "86.5%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[9.5px] text-white/80 mb-0.5">
                        <span>P3: Video / Conf Interaktif</span>
                        <span className="font-bold text-amber-300">71.0%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full" style={{ width: "71.0%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 2 MOCKUP: Portal Kaprodi & Sekprodi */}
            {activeSlide === 1 && (
              <div className="w-full max-w-[380px] relative animate-fade-in transition-all duration-500">
                {/* Card 1: Top Floating Card - Evaluasi Dosen Prodi */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white ml-auto w-[85%] mb-3 hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-blue-400" />
                      Monitoring Dosen Prodi
                    </span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold">
                      Semester Aktif
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                        <span>Kinerja Sangat Baik</span>
                      </div>
                      <span className="font-bold text-emerald-300">11 Dosen</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="text-blue-400" />
                        <span>Kinerja Baik</span>
                      </div>
                      <span className="font-bold text-blue-300">3 Dosen</span>
                    </div>

                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber-400" />
                        <span>Perlu Perhatian</span>
                      </div>
                      <span className="font-bold text-amber-300">0 Dosen</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Bottom Floating Card - Notifikasi Kendala & Unduh Laporan */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white mr-auto w-[85%] hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-emerald-400" />
                      Audit & Laporan Prodi
                    </span>
                    <span className="text-[9.5px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                      Siap Ekspor
                    </span>
                  </div>
                  <p className="text-[10px] text-white/70 leading-relaxed">
                    Kaprodi dapat langsung mengunduh rekapitulasi performa dosen (XLS/PDF) per sesi atau rentang tanggal kalender untuk evaluasi berkala.
                  </p>
                </div>
              </div>
            )}

            {/* SLIDE 3 MOCKUP: Standar Mutu Akademik CDU */}
            {activeSlide === 2 && (
              <div className="w-full max-w-[380px] relative animate-fade-in transition-all duration-500">
                {/* Card 1: Top Floating Card - Standar CDU */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white ml-auto w-[85%] mb-3 hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-400" />
                      Standar Kinerja Universitas
                    </span>
                    <span className="text-[9.5px] bg-white/10 text-white/90 px-1.5 py-0.5 rounded font-bold">
                      CDU Quality
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-black text-emerald-300">≥ 90.0%</div>
                      <div className="text-[9px] text-white/80">Target Presensi Minimal</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-black text-white">16 Sesi</div>
                      <div className="text-[9px] text-white/80">Kurikulum Penuh</div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Bottom Floating Card - Sinkronisasi Sistem */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 shadow-2xl text-white mr-auto w-[85%] hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-white/80 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-300" />
                      Sinkronisasi Otomatis
                    </span>
                    <span className="text-[9.5px] text-emerald-300 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] text-white/70 leading-relaxed">
                    Terhubung langsung dengan jadwal perkuliahan dan data dosen Nusa Putra untuk pelaporan penjaminan mutu yang akuntabel dan transparan.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── BOTTOM SECTION: Badge, Headline, Description, & Carousel Bars ─ */}
          <div className="relative z-10 pt-4">
            {/* App Icon Badge (matching Kezak logo badge) */}
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#a80063] to-[#d946ef] p-0.5 shadow-lg shadow-[#a80063]/30 mb-3.5 inline-flex items-center justify-center border border-white/20">
              <BadgeIcon size={22} className="text-white" />
            </div>

            {/* Headline */}
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
              {currentSlide.headline}
            </h2>

            {/* Description */}
            <p className="text-xs sm:text-[13px] text-white/75 font-normal mt-2 leading-relaxed max-w-lg">
              {currentSlide.description}
            </p>

            {/* Carousel Indicator Bars (3 Pill Bars matching screenshot) */}
            <div className="flex items-center gap-2 mt-6">
              {SLIDES.map((slide, index) => {
                const isActive = activeSlide === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Slide ${index + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                      isActive
                        ? "w-10 sm:w-12 bg-white shadow-sm"
                        : "w-4 sm:w-6 bg-white/25 hover:bg-white/45"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* ── Contact Admin CDU Modal ─────────────────────────────────────── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#a80063]/10 text-[#a80063] flex items-center justify-center">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Bantuan Akses Akun</h3>
                <p className="text-xs text-slate-500">Administrator CDU Nusa Putra</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Jika Anda mengalami kendala saat masuk, lupa kata sandi, atau memerlukan pembuatan akun pimpinan/dosen, silakan hubungi tim CDU melalui saluran resmi:
            </p>

            <div className="space-y-2.5 text-xs text-slate-700 mb-5">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <Mail size={15} className="text-[#a80063]" />
                <div>
                  <span className="font-semibold block text-slate-900">Email Resmi CDU</span>
                  <span className="text-slate-500 text-[11px]">cdu@nusaputra.ac.id</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <Phone size={15} className="text-[#a80063]" />
                <div>
                  <span className="font-semibold block text-slate-900">WhatsApp Helpdesk CDU</span>
                  <span className="text-slate-500 text-[11px]">+62 812-8888-CDU (Jam Kerja 08:00 - 16:30)</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <Building size={15} className="text-[#a80063]" />
                <div>
                  <span className="font-semibold block text-slate-900">Ruang Layanan CDU</span>
                  <span className="text-slate-500 text-[11px]">Gedung Rektorat Lt. 2, Universitas Nusa Putra</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Mengerti & Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-400">
          Memuat Portal CDU...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

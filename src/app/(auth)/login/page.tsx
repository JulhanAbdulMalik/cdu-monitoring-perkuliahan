"use client";
// src/app/(auth)/login/page.tsx
// Compact, Minimalist & Modern Split Layout Login Page
// Brand: CDU PORTAL (Curriculum Development Unit - Universitas Nusa Putra)

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
  X,
  Phone,
  Building,
} from "lucide-react";

interface SlideData {
  id: number;
  headline: string;
  description: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    headline: "Pusat Monitoring Perkuliahan",
    description:
      "Pantau performa kehadiran dosen, kepatuhan konten perkuliahan, dan status sesi perkuliahan secara real-time.",
  },
  {
    id: 2,
    headline: "Portal Pengawasan Kaprodi & Sekprodi",
    description:
      "Evaluasi capaian dosen pengampu, deteksi dini kendala sesi, dan unduh laporan audit perkuliahan prodi.",
  },
  {
    id: 3,
    headline: "Standar Mutu & Target Akademik Unggul",
    description:
      "Standarisasi presensi minimal 90%, materi perkuliahan, tugas, kuis, dan video konferensi.",
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

  return (
    <div className="min-h-screen bg-slate-100/90 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Background Subtle Ambient Glow */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-[#a80063]/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-[#d946ef]/8 blur-3xl pointer-events-none" />

      {/* Main Card Frame - Sleeker & Scaled for Spacious Look */}
      <div className="w-full max-w-[980px] bg-white rounded-2xl sm:rounded-3xl shadow-[0_16px_45px_-12px_rgba(15,23,42,0.09)] border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[520px] lg:h-[565px] relative z-10">
        
        {/* ── LEFT PANEL: Form Area (Clean, Minimalist & Airy) ─────────────── */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white relative">
          
          {/* Top Brand Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#a80063] to-[#d946ef] flex items-center justify-center shadow-xs text-white shrink-0">
              <GraduationCap size={16} strokeWidth={2.3} />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                  CDU
                </span>
                <span className="text-sm font-bold text-[#a80063] tracking-tight leading-none">
                  PORTAL
                </span>
              </div>
              <span className="text-[9px] font-medium text-slate-400 tracking-wider uppercase block mt-0.5">
                Curriculum Development Unit
              </span>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="my-auto py-4 max-w-[370px] w-full mx-auto">
            <div className="mb-5 text-left">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Selamat Datang
              </h1>
              <p className="text-[11.5px] text-slate-500 font-normal mt-1 leading-relaxed">
                Masuk untuk mengakses sistem monitoring perkuliahan.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* Field: Email atau Username */}
              <div>
                <label
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                  htmlFor="email"
                >
                  Email atau Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Mail size={14} />
                  </div>
                  <input
                    id="email"
                    type="text"
                    placeholder="admin atau nama@nusaputra.ac.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Field: Password */}
              <div>
                <label
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                  htmlFor="password"
                >
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock size={14} />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full pl-9 pr-9 py-2 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1.5 py-2.5 px-4 bg-[#a80063] hover:bg-[#8c0052] active:bg-[#770046] text-white text-xs font-bold rounded-lg shadow-xs shadow-[#a80063]/20 hover:shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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

            {/* Minimalist Help Text Link (No heavy box) */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="text-[11px] text-slate-400 hover:text-[#a80063] transition-colors inline-flex items-center gap-1 cursor-pointer font-medium"
              >
                <HelpCircle size={12} />
                <span>Butuh bantuan atau lupa password?</span>
              </button>
            </div>
          </div>

          {/* Left Footer Info */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Julhan A Malik &copy; {new Date().getFullYear()} Universitas Nusa Putra</span>
            <span className="font-medium text-slate-400">CDU Portal v1.0</span>
          </div>
        </div>

        {/* ── RIGHT PANEL: Hero Showcase Slider (Deep Brand Gradient) ──────── */}
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="lg:col-span-6 relative bg-gradient-to-br from-[#240015] via-[#3b0022] to-[#14000b] p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-hidden text-white min-h-[400px] lg:min-h-full"
        >
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {/* Glowing Radial Color Accents */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#a80063]/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-[#d946ef]/15 blur-3xl pointer-events-none" />

          {/* ── TOP SECTION: Floating UI Mockup Cards (Symmetrical & Centered) ─── */}
          <div className="relative z-10 w-full pt-1 pb-3 flex items-center justify-center">
            
            {/* SLIDE 1 MOCKUP: Donut Kehadiran & Skor 3 Pilar */}
            {activeSlide === 0 && (
              <div className="w-full max-w-[410px] mx-auto flex flex-col gap-2.5 sm:gap-3 animate-fade-in transition-all duration-500">
                {/* Card 1: Donut Kehadiran Dosen */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-2.5">
                    <span className="flex items-center gap-2">
                      {/* <BarChart3 size={15} className="text-emerald-400" /> */}
                      <span>Evaluasi Kehadiran Dosen</span>
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-400/30">
                      Target ≥90%
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* SVG Donut Chart */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 36 36">
                        <path
                          className="text-white/15"
                          strokeWidth="3.6"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-emerald-400"
                          strokeDasharray="88.1, 100"
                          strokeWidth="3.6"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs sm:text-[13px] font-extrabold text-white leading-none">88.1%</span>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="space-y-1 text-[11px] sm:text-xs flex-1">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-white/80">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                          Hadir
                        </span>
                        <span className="font-bold text-emerald-300">1.274</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-white/80">
                          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                          Alpha
                        </span>
                        <span className="font-bold text-rose-300">171</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-white/80">
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                          Ganti Hari
                        </span>
                        <span className="font-bold text-amber-300">24</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Kelengkapan 3 Pilar */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-2.5">
                    <span className="flex items-center gap-2">
                      {/* <Layers size={15} className="text-pink-400" /> */}
                      <span>Kelengkapan Konten 3 Pilar</span>
                    </span>
                    <span className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full font-mono font-medium border border-white/15">
                      1.382 Kelas
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-xs text-white/85 mb-1">
                        <span>P1: Lecture Note & Slide</span>
                        <span className="font-bold text-emerald-300">94.2%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: "94.2%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-xs text-white/85 mb-1">
                        <span>P2: Tugas & Kuis</span>
                        <span className="font-bold text-emerald-300">86.5%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: "86.5%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10.5px] sm:text-xs text-white/85 mb-1">
                        <span>P3: Video & Live Conference</span>
                        <span className="font-bold text-amber-300">71.0%</span>
                      </div>
                      <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: "71.0%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 2 MOCKUP: Portal Kaprodi & Sekprodi */}
            {activeSlide === 1 && (
              <div className="w-full max-w-[410px] mx-auto flex flex-col gap-2.5 sm:gap-3 animate-fade-in transition-all duration-500">
                {/* Card 1: Evaluasi Dosen Prodi */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-2">
                    <span className="flex items-center gap-2">
                      {/* <Users size={15} className="text-blue-400" /> */}
                      <span>Monitoring Dosen Prodi</span>
                    </span>
                    <span className="text-[10px] bg-blue-500/25 text-blue-300 px-2 py-0.5 rounded-full font-bold border border-blue-400/30">
                      Semester Aktif
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[10.5px] sm:text-xs">
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        <span>Kinerja Sangat Baik</span>
                      </div>
                      <span className="font-bold text-emerald-300">11 Dosen</span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={13} className="text-blue-400" />
                        <span>Kinerja Baik</span>
                      </div>
                      <span className="font-bold text-blue-300">3 Dosen</span>
                    </div>

                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-400" />
                        <span>Perlu Perhatian</span>
                      </div>
                      <span className="font-bold text-amber-300">0 Dosen</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Notifikasi Kendala & Unduh Laporan */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-1.5">
                    <span className="flex items-center gap-2">
                      {/* <Calendar size={15} className="text-emerald-400" /> */}
                      <span>Audit & Laporan Prodi</span>
                    </span>
                    <span className="text-[10px] bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-400/30">
                      Siap Ekspor
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-white/80 leading-relaxed">
                    Kaprodi dapat langsung mengunduh rekap performa dosen (format XLS/PDF) per sesi atau rentang tanggal kalender untuk evaluasi berkala.
                  </p>
                </div>
              </div>
            )}

            {/* SLIDE 3 MOCKUP: Standar Mutu Akademik CDU */}
            {activeSlide === 2 && (
              <div className="w-full max-w-[410px] mx-auto flex flex-col gap-2.5 sm:gap-3 animate-fade-in transition-all duration-500">
                {/* Card 1: Standar CDU */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-2">
                    <span className="flex items-center gap-2">
                      {/* <ShieldCheck size={15} className="text-emerald-400" /> */}
                      <span>Standar Kinerja Universitas</span>
                    </span>
                    <span className="text-[10px] bg-white/10 text-white/90 px-2 py-0.5 rounded-full font-bold border border-white/15">
                      CDU Quality
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-between">
                    <div>
                      <div className="text-sm sm:text-base font-black text-emerald-300">≥ 90.0%</div>
                      <div className="text-[10px] sm:text-[10.5px] text-white/80 font-medium">Target Presensi Minimal</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black text-white">16 Sesi</div>
                      <div className="text-[10px] sm:text-[10.5px] text-white/80 font-medium">Kurikulum Penuh</div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Sinkronisasi Sistem */}
                <div className="w-full bg-white/[0.09] hover:bg-white/[0.13] backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 shadow-xl shadow-black/20 text-white transition-all duration-300">
                  <div className="flex items-center justify-between text-xs sm:text-[13px] font-semibold text-white/90 mb-1.5">
                    <span className="flex items-center gap-2">
                      {/* <Sparkles size={15} className="text-amber-300" /> */}
                      <span>Sinkronisasi Otomatis</span>
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-white/80 leading-relaxed">
                    Terhubung langsung dengan jadwal perkuliahan dan data dosen Nusa Putra untuk pelaporan penjaminan mutu yang akuntabel dan transparan.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── BOTTOM SECTION: Headline, Description, & Carousel Bars ─────── */}
          <div className="relative z-10 pt-2">
            {/* Headline */}
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
              {currentSlide.headline}
            </h2>

            {/* Description */}
            <p className="text-[11px] text-white/70 font-normal mt-1 leading-relaxed max-w-md">
              {currentSlide.description}
            </p>

            {/* Carousel Indicator Bars (Compact Pill Lines) */}
            <div className="flex items-center gap-1.5 mt-4">
              {SLIDES.map((slide, index) => {
                const isActive = activeSlide === index;
                return (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Slide ${index + 1}`}
                    className={`h-1 rounded-full transition-all duration-500 cursor-pointer ${
                      isActive
                        ? "w-7 sm:w-8 bg-white shadow-xs"
                        : "w-2.5 sm:w-3 bg-white/25 hover:bg-white/45"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Contact Admin CDU Modal (Enlarged & Comfortable Scale) ─────── */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-[22px] max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200/90 relative">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Tutup modal"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              {/* <div className="w-11 h-11 rounded-xl bg-[#a80063]/10 text-[#a80063] flex items-center justify-center shrink-0">
                <HelpCircle size={22} />
              </div> */}
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  Bantuan Akses Akun
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Curriculum Development Unit (CDU)
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed mb-4">
              Jika Anda mengalami kendala saat masuk atau lupa kata sandi akun, silakan hubungi tim CDU melalui saluran resmi:
            </p>

            {/* Contact Cards */}
            <div className="space-y-2.5 mb-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center shrink-0 text-[#a80063]">
                  <Mail size={16} />
                </div>
                <div>
                  <span className="font-bold block text-slate-900 text-xs sm:text-[13px]">
                    Email CDU
                  </span>
                  <span className="text-slate-500 text-[11px] sm:text-xs block mt-0.5">
                    cdu@nusaputra.ac.id
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center shrink-0 text-[#a80063]">
                  <Phone size={16} />
                </div>
                <div>
                  <span className="font-bold block text-slate-900 text-xs sm:text-[13px]">
                    WhatsApp Staff CDU
                  </span>
                  <span className="text-slate-500 text-[11px] sm:text-xs block mt-0.5">
                    0831-1103-0309
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center shrink-0 text-[#a80063]">
                  <Building size={16} />
                </div>
                <div>
                  <span className="font-bold block text-slate-900 text-xs sm:text-[13px]">
                    Ruang Layanan CDU
                  </span>
                  <span className="text-slate-500 text-[11px] sm:text-xs block mt-0.5">
                    Gedung B Lt.6, Universitas Nusa Putra
                  </span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 sm:py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              Tutup
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
          Memuat CDU Portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

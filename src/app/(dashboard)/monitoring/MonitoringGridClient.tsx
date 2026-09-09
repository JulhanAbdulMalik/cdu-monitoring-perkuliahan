"use client";
// src/app/(dashboard)/monitoring/MonitoringGridClient.tsx
// Compact & High-Speed 3-Pillar Monitoring Grid with Live Conference Tracker & Quick Actions

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  HelpCircle,
  Laptop,
  Building,
  Save,
  Search,
  User,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileText,
  Presentation,
  Video,
  CheckSquare,
  HelpCircle as QuizIcon,
  Video as VideoIcon,
  Zap,
  Layers,
  ChevronDown,
  X,
  MessageSquare,
} from "lucide-react";
import {
  updateSingleMonitoringSesi,
  updateBatchMonitoringSesi,
  quickSetAllAttendance,
  quickSetAllPillars,
} from "@/actions/monitoring";
import { calculateSessionPillars, calculateClassSummary } from "@/lib/score-calculator";
import ImportEdlinkModal from "@/components/monitoring/ImportEdlinkModal";
import { ParsedSesiData } from "@/lib/excel-parser";
import {
  getEstimatedSessionDate,
  DEFAULT_SEMESTER_START_DATE,
  formatDateShort,
  HariLiburItem,
} from "@/lib/utils";

const CATATAN_PRESETS = [
  "Ganti hari",
  "Tanggal merah",
  "Dinas luar",
  "Cuti",
  "Sakit",
  "Online"
] as const;

interface MonitoringSesiData {
  id: string;
  nomorSesi: number;
  jenisSesi: "REGULER" | "UTS" | "UAS";
  tanggal?: string | Date | null;
  kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI" | "ALPHA" | "HADIR_TDK_LENGKAP";
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;
  catatanCdu?: string | null;
  catatan?: string | null;
  isKhadiranOnly?: boolean;
}

interface KelasDetailData {
  id: string;
  kodeKelas: string;
  jadwalHari: string;
  jadwalJam: string;
  modePembelajaran: "DARING" | "LURING";
  semester: {
    id: string;
    tahunAkademik: string;
    periode: string;
    tanggalMulai?: Date | string | null;
    hariLibur?: HariLiburItem[];
  };
  mataKuliah: {
    id: string;
    kode: string;
    nama: string;
    sks: number;
    prodi: {
      nama: string;
      kode: string;
    };
  };
  dosen: {
    id: string;
    nama: string;
    nidn: string | null;
    email: string | null;
  };
  monitoringSesi: MonitoringSesiData[];
}

interface SimpleKelasItem {
  id: string;
  kodeKelas: string;
  mataKuliah: { nama: string; kode: string };
  dosen: { nama: string };
}

interface MonitoringGridClientProps {
  kelasList: SimpleKelasItem[];
  currentKelas: KelasDetailData | null;
  selectedKelasId: string;
}

export default function MonitoringGridClient({
  kelasList,
  currentKelas,
  selectedKelasId,
}: MonitoringGridClientProps) {
  const router = useRouter();
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKelasQuery, setSearchKelasQuery] = useState("");

  const [sesiList, setSesiList] = useState<MonitoringSesiData[]>(
    currentKelas?.monitoringSesi || []
  );
  const [customCatatanIds, setCustomCatatanIds] = useState<Record<string, boolean>>({});

  // Sync sesiList ONLY when switching to a different class ID
  useEffect(() => {
    if (currentKelas?.monitoringSesi) {
      setSesiList(currentKelas.monitoringSesi);
      setHasUnsavedChanges(false);
    }
  }, [currentKelas?.id]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter kelasList based on search query
  const filteredKelasList = kelasList.filter((k) => {
    if (!searchKelasQuery.trim()) return true;
    const q = searchKelasQuery.toLowerCase();
    return (
      k.kodeKelas.toLowerCase().includes(q) ||
      k.mataKuliah.nama.toLowerCase().includes(q) ||
      k.mataKuliah.kode.toLowerCase().includes(q) ||
      k.dosen.nama.toLowerCase().includes(q)
    );
  });

  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // State Dialog Konfirmasi Aksi Cepat
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: "ALL_HADIR" | "ALL_PILLARS" | null;
    title: string;
    description: string;
    confirmLabel: string;
    confirmColor: "emerald" | "brand";
    action: () => void;
  }>({
    isOpen: false,
    type: null,
    title: "",
    description: "",
    confirmLabel: "",
    confirmColor: "emerald",
    action: () => {},
  });

  // Handler update grid state setelah sukses import Excel Edlink
  function handleSuccessApply(parsedSesi: ParsedSesiData[]) {
    setSesiList((prev) =>
      prev.map((s) => {
        const p = parsedSesi.find((x) => x.nomorSesi === s.nomorSesi);
        if (!p) return s;
        const isExam = s.nomorSesi === 8 || s.nomorSesi === 16;
        return {
          ...s,
          lectureNote: isExam ? null : p.lectureNote,
          slide: isExam ? null : p.slide,
          video: isExam ? null : p.video,
          conference: isExam ? null : p.conference,
          tugas: isExam ? null : p.tugas,
          kuis: isExam ? null : p.kuis,
        };
      })
    );
    setHasUnsavedChanges(true);
  }

  // Prompt warning if user tries to close/navigate away with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Hitung Metrik & Kuota 3 Pilar
  const summary = calculateClassSummary(
    sesiList,
    currentKelas?.modePembelajaran || "DARING"
  );

  // ── Handler Toggle Kehadiran (Local State Only) ───────────────────────────
  function handleKehadiranChange(
    sesiId: string,
    kehadiran: "HADIR" | "TIDAK_HADIR" | "HADIR_TIDAK_LENGKAP" | "BELUM_DIISI"
  ) {
    setSesiList((prev) =>
      prev.map((s) => (s.id === sesiId ? { ...s, kehadiran } : s))
    );
    setHasUnsavedChanges(true);
  }

  // ── Handler Toggle Komponen Materi (Local State Only) ─────────────────────
  function handleContentToggle(
    sesiId: string,
    field: "lectureNote" | "slide" | "video" | "conference" | "tugas" | "kuis"
  ) {
    setSesiList((prev) =>
      prev.map((s) => {
        if (s.id === sesiId && !s.isKhadiranOnly) {
          return { ...s, [field]: !s[field] };
        }
        return s;
      })
    );
    setHasUnsavedChanges(true);
  }

  // ── Handler Ubah Tanggal Sesi (Ganti Hari / Custom) ────────────────────────
  function handleTanggalChange(sesiId: string, newDateStr: string) {
    setSesiList((prev) =>
      prev.map((s) => {
        if (s.id === sesiId) {
          const semStartStr = currentKelas?.semester?.tanggalMulai
            ? new Date(currentKelas.semester.tanggalMulai).toISOString().split("T")[0]
            : DEFAULT_SEMESTER_START_DATE;
          const defDate = getEstimatedSessionDate(
            s.nomorSesi,
            currentKelas?.jadwalHari,
            semStartStr,
            currentKelas?.semester?.hariLibur
          ).toISOString().split("T")[0];

          const isDifferent = newDateStr && newDateStr !== defDate;
          let updatedCatatan = s.catatanCdu ?? s.catatan;
          if (isDifferent) {
            if (!updatedCatatan || updatedCatatan.trim() === "") {
              updatedCatatan = "Ganti hari";
            }
          } else if (updatedCatatan === "Ganti hari") {
            updatedCatatan = null;
          }

          return {
            ...s,
            tanggal: newDateStr ? new Date(`${newDateStr}T00:00:00.000Z`) : null,
            catatan: updatedCatatan,
            catatanCdu: updatedCatatan,
          };
        }
        return s;
      })
    );
    setHasUnsavedChanges(true);
  }

  // ── Handler Catatan ────────────────────────────────────────────────────────
  function handleCatatanChange(sesiId: string, catatan: string) {
    const updated = sesiList.map((s) => (s.id === sesiId ? { ...s, catatan, catatanCdu: catatan } : s));
    setSesiList(updated);
    setHasUnsavedChanges(true);
  }

  // ── Quick Action: Set Semua Hadir (Dengan Konfirmasi) ──────────────────────
  function requestQuickSetAllHadir() {
    if (!currentKelas) return;
    setConfirmDialog({
      isOpen: true,
      type: "ALL_HADIR",
      title: "Konfirmasi Set Semua Hadir",
      description: `Apakah Anda yakin ingin mengubah status kehadiran seluruh sesi (Sesi 1 s/d 16) menjadi HADIR untuk kelas [${currentKelas.kodeKelas}]?`,
      confirmLabel: "Ya, Set Semua Hadir",
      confirmColor: "emerald",
      action: () => {
        setSesiList((prev) => prev.map((s) => ({ ...s, kehadiran: "HADIR" })));
        setHasUnsavedChanges(true);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        toast.success("Semua sesi diatur ke HADIR. Klik 'Simpan Perubahan' di atas untuk menyimpan ke server.");
      },
    });
  }

  // ── Quick Action: Set Semua 3 Pilar Lengkap (Dengan Konfirmasi) ────────────
  function requestQuickSetAllPillarsComplete() {
    if (!currentKelas) return;
    setConfirmDialog({
      isOpen: true,
      type: "ALL_PILLARS",
      title: "Konfirmasi Set 3 Pilar Lengkap",
      description: `Apakah Anda yakin ingin mengatur seluruh sesi reguler (Sesi 1–7 & 9–15) menjadi 3 Pilar Lengkap (Slide, Tugas, Video) dengan skor 3/3 untuk kelas [${currentKelas.kodeKelas}]?`,
      confirmLabel: "Ya, Set 3 Pilar Lengkap",
      confirmColor: "brand",
      action: () => {
        setSesiList((prev) =>
          prev.map((s) => {
            if (s.nomorSesi === 8 || s.nomorSesi === 16) return s;
            return {
              ...s,
              slide: true,
              tugas: true,
              video: true,
            };
          })
        );
        setHasUnsavedChanges(true);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        toast.success("Semua sesi reguler diatur ke 3 Pilar Lengkap. Klik 'Simpan Perubahan' di atas untuk menyimpan ke server.");
      },
    });
  }

  // ── Simpan Semua Manual (Force Sync Database) ─────────────────────────────
  async function handleSaveAll() {
    if (!currentKelas) return;
    setSaving(true);

    try {
      const semStartStr = currentKelas.semester?.tanggalMulai
        ? new Date(currentKelas.semester.tanggalMulai).toISOString().split("T")[0]
        : DEFAULT_SEMESTER_START_DATE;

      const payload = sesiList.map((s) => {
        const defDate = getEstimatedSessionDate(
          s.nomorSesi,
          currentKelas.jadwalHari,
          semStartStr,
          currentKelas.semester?.hariLibur
        ).toISOString().split("T")[0];

        const rawCatatan = s.catatanCdu ?? s.catatan ?? "";
        const isManualGantiHari = rawCatatan.trim().toLowerCase() === "ganti hari";

        const finalTanggal = isManualGantiHari
          ? (s.tanggal ? (typeof s.tanggal === "string" ? s.tanggal : s.tanggal.toISOString()) : `${defDate}T00:00:00.000Z`)
          : (rawCatatan !== "" && s.tanggal)
            ? (typeof s.tanggal === "string" ? s.tanggal : s.tanggal.toISOString())
            : `${defDate}T00:00:00.000Z`;

        return {
          id: s.id,
          kehadiran: s.kehadiran,
          lectureNote: s.lectureNote,
          slide: s.slide,
          video: s.video,
          conference: s.conference,
          tugas: s.tugas,
          kuis: s.kuis,
          catatanCdu: s.catatanCdu ?? s.catatan ?? null,
          tanggal: finalTanggal,
        };
      });

      const res = await updateBatchMonitoringSesi(currentKelas.id, payload);
      if (res.success) {
        toast.success("Semua data monitoring berhasil disimpan!");
        setHasUnsavedChanges(false);
      } else {
        toast.error(res.error || "Gagal menyimpan perubahan");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Class Switcher & Action Top Bar ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <Link
            href="/monitoring"
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-[#fdf2f8] text-slate-500 hover:text-[#a80063] border border-slate-200/80 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs"
            title="Kembali ke Daftar Kelas Monitoring"
          >
            <ArrowLeft size={16} />
          </Link>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
              <Layers size={18} className="text-[#a80063]" />
              <span>Grid Monitoring Perkuliahan (3 Pilar)</span>
            </h1>
            <p className="text-xs text-slate-500 font-normal mt-1">
              Evaluasi kepatuhan mengajar, keterpenuhan 3 pilar materi, dan Live Conference
            </p>
          </div>
        </div>

        {/* Controls: Class Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* Searchable Class Combobox */}
          <div className="relative" ref={searchDropdownRef}>
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchKelasQuery}
                onChange={(e) => {
                  setSearchKelasQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder={
                  currentKelas
                    ? `[${currentKelas.kodeKelas}] ${currentKelas.mataKuliah.nama}`
                    : "Cari kelas..."
                }
                className="pl-8 pr-7 py-1.5 bg-slate-50 focus:bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/15 outline-none shadow-xs w-[220px] sm:w-[260px] transition-all truncate placeholder:text-slate-700 placeholder:font-bold"
              />
              {searchKelasQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKelasQuery("");
                    setIsSearchOpen(true);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  title="Hapus filter"
                >
                  <X size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Buka daftar kelas"
                >
                  <ChevronDown size={13} className={`transition-transform duration-150 ${isSearchOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {/* Floating Dropdown Results */}
            {isSearchOpen && (
              <div className="absolute right-0 mt-1.5 w-[280px] sm:w-[340px] bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 max-h-[300px] overflow-y-auto divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between bg-slate-50/70">
                  <span>Daftar Kelas ({filteredKelasList.length})</span>
                  <span className="text-[9px] text-slate-400 font-normal">Klik untuk pilih</span>
                </div>

                {filteredKelasList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Tidak ada kelas yang cocok dengan &quot;{searchKelasQuery}&quot;
                  </div>
                ) : (
                  filteredKelasList.map((k) => {
                    const isCurrent = k.id === currentKelas?.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchKelasQuery("");
                          router.push(`/monitoring/${k.id}`);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer ${
                          isCurrent
                            ? "bg-[#fdf2f8]/70 font-semibold text-[#a80063]"
                            : "text-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-[#fdf2f8] text-[#a80063] font-bold text-[10px] border border-[#fbcfe8]">
                              {k.kodeKelas}
                            </span>
                            <span className="font-bold text-slate-900 truncate">
                              {k.mataKuliah.nama}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {k.dosen.nama}
                          </p>
                        </div>

                        {isCurrent && (
                          <span className="text-[9px] font-bold text-[#a80063] bg-[#fdf2f8] px-1.5 py-0.5 rounded border border-[#fbcfe8] shrink-0">
                            Aktif
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Import Excel Edlink Button (Direct Popup Modal) */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
            title={`Import Laporan Aktivitas Edlink langsung ke kelas [${currentKelas?.kodeKelas}]`}
          >
            <FileSpreadsheet size={13} />
            <span>Import Edlink</span>
          </button>

          {/* Manual Save Button & Status Indicator */}
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !hasUnsavedChanges}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer ${
              saving
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-wait"
                : hasUnsavedChanges
                ? "bg-[#a80063] hover:bg-[#8e0054] text-white shadow-md shadow-[#a80063]/25 ring-2 ring-[#a80063]/20 animate-pulse active:scale-95 cursor-pointer"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default opacity-85"
            }`}
            title={
              hasUnsavedChanges
                ? "Ada perubahan data yang belum disimpan. Klik untuk menyimpan ke database."
                : "Semua data monitoring telah tersimpan di server."
            }
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save size={13} />
                <span>Simpan Perubahan</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Tersimpan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!currentKelas ? (
        <div className="duralux-card bg-white p-12 text-center text-slate-400">
          <p className="text-sm font-semibold text-slate-600">
            Belum ada kelas yang dipilih atau terdaftar di semester aktif.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Silakan tambahkan data kelas di menu Data Master Kelas terlebih dahulu.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── TOP CARDS ROW: Info Kelas, Statistik, Konten, & Aksi Cepat ────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 items-stretch">
            {/* Card 1: Detail Kelas & Mode */}
            <div className="duralux-card p-4 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold">
                    {currentKelas.kodeKelas}
                  </span>
                  {/* Mode Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                      currentKelas.modePembelajaran === "LURING"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {currentKelas.modePembelajaran === "LURING" ? (
                      <>
                        <Building size={10} />
                        <span>Offline</span>
                      </>
                    ) : (
                      <>
                        <Laptop size={10} />
                        <span>Online</span>
                      </>
                    )}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-tight line-clamp-1" title={currentKelas.mataKuliah.nama}>
                  {currentKelas.mataKuliah.nama}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  {currentKelas.mataKuliah.sks} SKS • {currentKelas.mataKuliah.prodi.nama}
                </p>
              </div>

              <div className="pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600 font-medium mt-3">
                <div className="flex items-center gap-1.5 truncate">
                  <User size={13} className="text-[#a80063] shrink-0" />
                  <span className="truncate" title={currentKelas.dosen.nama}>{currentKelas.dosen.nama}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock size={12} className="text-slate-400 shrink-0" />
                  <span>{currentKelas.jadwalHari}, {currentKelas.jadwalJam}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Statistik Kehadiran Dosen */}
            <div className="duralux-card p-4 bg-white flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Statistik Kehadiran Dosen
                </p>
                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-slate-900 leading-none">
                    {summary.persenKehadiran}%
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    {summary.totalHadir}/16 Sesi Terisi
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 mt-3">
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${summary.persenKehadiran}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] font-semibold pt-0.5">
                  <span className="text-emerald-600">{summary.totalHadirLengkap} Hadir</span>
                  <span className="text-amber-600">{summary.totalHadirTdkLengkap} HTL</span>
                  <span className="text-rose-600">{summary.totalAlpha} Alpha</span>
                </div>
              </div>
            </div>

            {/* Card 3: Skor 3 Pilar & Live Conference Quota */}
            <div className="duralux-card p-4 bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Konten Perkuliahan 3 Pilar
                  </p>
                  <span className="text-xs font-extrabold text-[#a80063]">
                    {summary.totalSkor3Pilar} / 42 Poin
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <h3 className="text-2xl font-bold text-[#a80063] leading-none">
                    {summary.persenKonten}%
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">
                    Kelengkapan Sesi
                  </span>
                </div>
              </div>

              <div className="mt-2.5">
                {currentKelas.modePembelajaran === "LURING" ? (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[10.5px] text-slate-600">
                    <div className="flex items-center gap-1 font-bold text-slate-700">
                      <Building size={11} className="text-emerald-600 shrink-0" />
                      <span>Kelas Offline (Tatap Muka)</span>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-0.5 leading-snug">
                      Bebas kewajiban 3 Pilar & Live Conference.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pra-UTS:</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold text-[9.5px] ${
                          summary.confPraUTS >= 3
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {summary.confPraUTS}/3 Conf {summary.confPraUTS >= 3 ? "✓" : "⚠️"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pra-UAS:</span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold text-[9.5px] ${
                          summary.confPraUAS >= 3
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {summary.confPraUAS}/3 Conf {summary.confPraUAS >= 3 ? "✓" : "⚠️"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Card 4: Aksi Cepat Staf CDU */}
            <div className="duralux-card p-4 bg-gradient-to-br from-slate-50 to-[#fdf2f8]/40 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs mb-2">
                <Zap size={14} className="text-amber-500" />
                <span>Aksi Cepat Staf CDU</span>
              </div>
              <div className="grid grid-cols-1 gap-2 mt-auto">
                <button
                  type="button"
                  onClick={requestQuickSetAllHadir}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 hover:border-emerald-300 font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <span>Set Semua Hadir (S1–S16)</span>
                </button>
                <button
                  type="button"
                  onClick={requestQuickSetAllPillarsComplete}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-lg bg-white hover:bg-[#fdf2f8] text-[#a80063] border border-slate-200 hover:border-[#fbcfe8] font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <span>Set 3 Pilar Lengkap (Skor 3)</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Matriks 16 Sesi Perkuliahan (FULL WIDTH) ────── */}
          <div className="duralux-card bg-white p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Matriks 16 Sesi Perkuliahan (3 Pilar Pembelajaran)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                    Klik tombol kehadiran atau aktifkan chip pilar (cukup 1 dari tiap pilar untuk memenuhi pilar tersebut)
                  </p>
                </div>

                {/* Legend Help */}
                <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-500 font-medium">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Skor 3 (Sempurna)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Skor 2 (Baik)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Skor 1 (Sebagian)</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto w-full">
                <table style={{ width: "100%" }} className="w-full min-w-full table-fixed text-left border-collapse">
                  <colgroup>
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/70">
                      <th className="py-2.5 px-3 font-bold whitespace-nowrap">Sesi</th>
                      <th className="py-2.5 px-3 font-bold">Kehadiran Dosen</th>
                      
                      {/* Pilar 1: L/S */}
                      <th className="py-2.5 px-2 text-center font-bold" title="Lecture Note ATAU Slide">
                        <div className="flex items-center justify-center gap-1">
                          <FileText size={12} className="text-[#a80063]" />
                          <span>Pilar 1: L/S</span>
                        </div>
                      </th>

                      {/* Pilar 2: Q/T */}
                      <th className="py-2.5 px-2 text-center font-bold" title="Quiz ATAU Tugas">
                        <div className="flex items-center justify-center gap-1">
                          <CheckSquare size={12} className="text-[#a80063]" />
                          <span>Pilar 2: T/Q</span>
                        </div>
                      </th>

                      {/* Pilar 3: T/V */}
                      <th className="py-2.5 px-2 text-center font-bold" title="Temu Virtual ATAU Video">
                        <div className="flex items-center justify-center gap-1">
                          <VideoIcon size={12} className="text-[#a80063]" />
                          <span>Pilar 3: V/C</span>
                        </div>
                      </th>

                      <th className="py-2.5 px-3 text-center font-bold">Skor Pilar</th>

                      {/* Tanggal */}
                      <th className="py-2.5 px-3 font-bold">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-[#a80063]" />
                          <span>Tanggal</span>
                        </div>
                      </th>

                      {/* Catatan CDU */}
                      <th className="py-2.5 px-3 font-bold">
                        <div className="flex items-center gap-1">
                          <MessageSquare size={12} className="text-[#a80063]" />
                          <span>Catatan</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {sesiList.map((sesi) => {
                      const isExam = sesi.nomorSesi === 8 || sesi.nomorSesi === 16;
                      const pilar = calculateSessionPillars(sesi);
                      const semStartStr = currentKelas?.semester?.tanggalMulai
                        ? new Date(currentKelas.semester.tanggalMulai).toISOString().split("T")[0]
                        : DEFAULT_SEMESTER_START_DATE;
                      const defaultEstimatedDate = getEstimatedSessionDate(
                        sesi.nomorSesi,
                        currentKelas?.jadwalHari,
                        semStartStr,
                        currentKelas?.semester?.hariLibur
                      );
                      const defaultDateStr = defaultEstimatedDate.toISOString().split("T")[0];
                      const rawCatatan = sesi.catatanCdu ?? sesi.catatan ?? "";
                      const isManualGantiHari = rawCatatan.trim().toLowerCase() === "ganti hari";

                      const currentDateStr = isManualGantiHari
                        ? (sesi.tanggal
                            ? (typeof sesi.tanggal === "string" ? sesi.tanggal.split("T")[0] : sesi.tanggal.toISOString().split("T")[0])
                            : defaultDateStr)
                        : (rawCatatan !== "" && sesi.tanggal)
                          ? (typeof sesi.tanggal === "string" ? sesi.tanggal.split("T")[0] : sesi.tanggal.toISOString().split("T")[0])
                          : defaultDateStr;

                      const isRescheduled = isManualGantiHari && currentDateStr !== defaultDateStr;

                      return (
                        <tr
                          key={sesi.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isExam ? "bg-[#fdf2f8]/40 font-semibold" : ""
                          }`}
                        >
                          {/* 1. Sesi Badge */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-bold text-xs text-slate-900">
                                Sesi {sesi.nomorSesi}
                              </span>
                              {sesi.nomorSesi === 8 && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[9px] font-bold border border-purple-200">
                                  UTS
                                </span>
                              )}
                              {sesi.nomorSesi === 16 && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold border border-indigo-200">
                                  UAS
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Kehadiran Dosen */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              {/* HADIR */}
                              <button
                                type="button"
                                onClick={() => handleKehadiranChange(sesi.id, "HADIR")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  sesi.kehadiran === "HADIR"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                              >
                                Hadir
                              </button>

                              {/* HADIR TIDAK LENGKAP */}
                              <button
                                type="button"
                                onClick={() => handleKehadiranChange(sesi.id, "HADIR_TIDAK_LENGKAP")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  sesi.kehadiran === "HADIR_TIDAK_LENGKAP" || sesi.kehadiran === "HADIR_TDK_LENGKAP"
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                              >
                                HTL
                              </button>

                              {/* TIDAK HADIR / ALPHA */}
                              <button
                                type="button"
                                onClick={() => handleKehadiranChange(sesi.id, "TIDAK_HADIR")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                  sesi.kehadiran === "TIDAK_HADIR" || sesi.kehadiran === "ALPHA"
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                }`}
                              >
                                Alpha
                              </button>

                              {/* BELUM DIISI RESET */}
                              <button
                                type="button"
                                onClick={() => handleKehadiranChange(sesi.id, "BELUM_DIISI")}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                                  sesi.kehadiran === "BELUM_DIISI"
                                    ? "bg-slate-300 text-slate-800"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                                title="Reset / Belum Diisi"
                              >
                                —
                              </button>
                            </div>
                          </td>

                          {/* 3. Pilar 1: L/S (Lecture Note / Slide) */}
                          <td className="py-2.5 px-2 text-center">
                            {isExam ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "lectureNote")}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.lectureNote
                                      ? "bg-[#a80063] text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Lecture Note (Modul / Handout)"
                                >
                                  LN
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "slide")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.slide
                                      ? "bg-[#a80063] text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Slide Presentasi (Materi)"
                                >
                                  Slide
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 4. Pilar 2: Q/T (Quiz / Tugas) */}
                          <td className="py-2.5 px-2 text-center">
                            {isExam ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "tugas")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.tugas
                                      ? "bg-[#a80063] text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Tugas Mahasiswa"
                                >
                                  Tugas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "kuis")}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.kuis
                                      ? "bg-[#a80063] text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Kuis / Evaluasi"
                                >
                                  Kuis
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 5. Pilar 3: T/V (Temu Virtual / Video) */}
                          <td className="py-2.5 px-2 text-center">
                            {isExam ? (
                              <span className="text-slate-300 text-xs">—</span>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "video")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.video
                                      ? "bg-[#a80063] text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Video Pembelajaran (YouTube / Edlink)"
                                >
                                  Video
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleContentToggle(sesi.id, "conference")}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    sesi.conference
                                      ? "bg-purple-600 text-white shadow-xs"
                                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                                  }`}
                                  title="Live Conference (Zoom / Temu Virtual)"
                                >
                                  Conf 📡
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 6. Skor Pilar (0, 1, 2, 3) */}
                          <td className="py-2.5 px-3 text-center">
                            {isExam ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Ujian
                              </span>
                            ) : pilar.score === 3 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                3/3 Sempurna
                              </span>
                            ) : pilar.score === 2 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                2/3 Baik
                              </span>
                            ) : pilar.score === 1 ? (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                1/3 Sebagian
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                0/3 Kosong
                              </span>
                            )}
                          </td>

                          {/* 7. Tanggal Pelaksanaan & Ganti Hari */}
                          <td className="py-2.5 px-2.5">
                            <div className="flex flex-col gap-1">
                              <input
                                type="date"
                                value={currentDateStr}
                                onChange={(e) => handleTanggalChange(sesi.id, e.target.value)}
                                className={`w-full text-[11px] px-2 py-1 rounded-md border transition-all outline-none font-medium cursor-pointer ${
                                  isRescheduled
                                    ? "border-amber-400 bg-amber-50 text-amber-900 font-bold focus:border-amber-500 focus:ring-1 focus:ring-amber-400/20"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20"
                                }`}
                                title={
                                  isRescheduled
                                    ? `Jadwal diubah (Ganti Hari). Jadwal default: ${formatDateShort(defaultEstimatedDate)}`
                                    : `Sesuai jadwal: ${currentKelas?.jadwalHari || "Senin"}, ${formatDateShort(defaultEstimatedDate)}`
                                }
                              />
                              {isRescheduled && (
                                <div className="flex items-center justify-between text-[9px] font-bold text-amber-700 px-0.5">
                                  <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Ganti Hari
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTanggalChange(sesi.id, defaultDateStr)}
                                    className="text-slate-400 hover:text-rose-600 underline font-normal cursor-pointer"
                                    title="Kembalikan ke jadwal asli"
                                  >
                                    Reset
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 8. Catatan CDU Dropdown */}
                          <td className="py-2 px-2.5">
                            {(() => {
                              const rawVal = sesi.catatanCdu ?? sesi.catatan ?? "";
                              const isPreset = (CATATAN_PRESETS as readonly string[]).includes(rawVal);
                              const isCustom = customCatatanIds[sesi.id] || (rawVal !== "" && !isPreset);

                              return (
                                <div className="relative w-full">
                                  {isCustom ? (
                                    <div className="relative flex items-center w-full animate-in fade-in duration-150">
                                      <input
                                        type="text"
                                        value={rawVal}
                                        onChange={(e) => handleCatatanChange(sesi.id, e.target.value)}
                                        placeholder="Ketik catatan..."
                                        autoFocus
                                        className="w-full text-xs pl-2.5 pr-7 py-1.5 rounded-lg border border-[#fbcfe8] bg-white text-[#a80063] font-semibold placeholder:text-slate-400 placeholder:font-normal outline-none focus:ring-2 focus:ring-[#a80063]/15 shadow-2xs"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCustomCatatanIds((prev) => ({ ...prev, [sesi.id]: false }));
                                          handleCatatanChange(sesi.id, "");
                                        }}
                                        className="absolute right-1.5 p-1 text-slate-400 hover:text-[#a80063] hover:bg-slate-50 rounded cursor-pointer transition-colors"
                                        title="Kembali ke pilihan dropdown"
                                      >
                                        <ChevronDown size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <select
                                      value={rawVal}
                                      onChange={(e) => {
                                        const selected = e.target.value;
                                        if (selected === "__CUSTOM__") {
                                          setCustomCatatanIds((prev) => ({ ...prev, [sesi.id]: true }));
                                          handleCatatanChange(sesi.id, "");
                                        } else {
                                          setCustomCatatanIds((prev) => ({ ...prev, [sesi.id]: false }));
                                          handleCatatanChange(sesi.id, selected);
                                        }
                                      }}
                                      className={`w-full text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-all cursor-pointer font-medium ${
                                        rawVal
                                          ? "border-[#fbcfe8] bg-[#fdf2f8] text-[#a80063] font-bold shadow-2xs"
                                          : "border-slate-200 bg-slate-50/70 text-slate-500 hover:text-slate-700 hover:bg-slate-100/80"
                                      }`}
                                    >
                                      <option value="" className="text-slate-400 font-normal">
                                        — Pilih Catatan —
                                      </option>
                                      {CATATAN_PRESETS.map((preset) => (
                                        <option key={preset} value={preset} className="text-slate-800">
                                          {preset}
                                        </option>
                                      ))}
                                      <option value="__CUSTOM__" className="text-[#a80063] font-medium">
                                        Lainnya (ketik)...
                                      </option>
                                    </select>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
        </div>
      )}

      {/* ── Confirmation Modal for Quick Actions ─────────────────────────── */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    confirmDialog.confirmColor === "emerald"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]"
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {confirmDialog.description}
                  </p>
                </div>
              </div>

              {/* <div className="mt-3.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
                <span className="font-bold shrink-0">🛡️ Info:</span>
                <span className="leading-tight">
                  Perubahan akan diterapkan ke matriks layar. Jangan lupa klik <strong>&quot;Simpan Perubahan&quot;</strong> di header untuk menyimpan ke database.
                </span>
              </div> */}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.action}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer active:scale-95 ${
                  confirmDialog.confirmColor === "emerald"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-[#a80063] hover:bg-[#8e0054] shadow-[#a80063]/25"
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Direct In-Place Edlink Import Modal ────────────────────────────── */}
      {currentKelas && (
        <ImportEdlinkModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          targetKelas={currentKelas as any}
          onSuccessApply={handleSuccessApply}
        />
      )}
    </div>
  );
}

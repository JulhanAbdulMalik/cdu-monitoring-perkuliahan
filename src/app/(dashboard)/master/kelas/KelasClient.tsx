"use client";
// src/app/(dashboard)/master/kelas/KelasClient.tsx
// Data Master Perkuliahan Terpadu (Mata Kuliah, Dosen, Kelas & Jadwal)
// Sesuai tema Duralux modern (#a80063 magenta, font Plus Jakarta Sans)

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import Link from "next/link";
import {
  School,
  Plus,
  Edit2,
  Trash2,
  Search,
  ArrowUpRight,
  Clock,
  Laptop,
  Building,
  Loader2,
  X,
  Sparkles,
  Calendar,
  FileSpreadsheet,
  BookOpen,
  UserCheck,
  Download,
  GraduationCap,
  Layers,
  DoorClosed,
} from "lucide-react";
import { createKelas, updateKelas, deleteKelas, getKelasList } from "@/actions/kelas";
import MasterImportModal from "@/components/master/MasterImportModal";
import { parseKelasExcel, commitKelasImport } from "@/actions/master-import";
import { generateTemplate } from "@/lib/template-generator";

interface KelasItem {
  id: string;
  kodeKelas: string;
  semesterId: string;
  mataKuliahId: string;
  dosenId: string;
  jadwalHari: string;
  jadwalJam: string;
  ruangan?: string | null;
  modePembelajaran: "DARING" | "LURING" | "BIMBINGAN";
  semester: {
    id: string;
    tahunAkademik: string;
    periode: string;
    aktif: boolean;
  };
  mataKuliah: {
    id: string;
    kode: string;
    nama: string;
    sks: number;
    prodi: {
      id: string;
      nama: string;
      kode: string;
    };
  };
  dosen: {
    id: string;
    nama: string;
  };
  monitoringSesi: {
    id: string;
    nomorSesi: number;
    kehadiran: string;
  }[];
}

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface MataKuliahOption {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  prodi: {
    id: string;
    nama: string;
    kode: string;
  };
}

interface DosenOption {
  id: string;
  nama: string;
  prodi?: {
    id: string;
    nama: string;
    kode: string;
  };
}

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

interface KelasClientProps {
  initialKelas: KelasItem[];
  semesters: SemesterOption[];
  mataKuliahList: MataKuliahOption[];
  dosenList: DosenOption[];
  prodiList: ProdiOption[];
  defaultSemesterId: string;
}

const HARI_OPTIONS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function KelasClient({
  initialKelas,
  semesters,
  mataKuliahList: initialMkList,
  dosenList: initialDosenList,
  prodiList,
  defaultSemesterId,
}: KelasClientProps) {
  const [mounted, setMounted] = useState(false);
  const [kelasList, setKelasList] = useState<KelasItem[]>(initialKelas);
  const [allMkList, setAllMkList] = useState<MataKuliahOption[]>(initialMkList);
  const [allDosenList, setAllDosenList] = useState<DosenOption[]>(initialDosenList);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSemester, setSelectedSemester] = useState<string>(defaultSemesterId);
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [filterHari, setFilterHari] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingKelas, setEditingKelas] = useState<KelasItem | null>(null);

  // Form states (Unified 1-Window Form)
  const [prodiId, setProdiId] = useState(prodiList[0]?.id || "");
  const [modeMk, setModeMk] = useState<"EXISTING" | "NEW">("EXISTING");
  const [mataKuliahId, setMataKuliahId] = useState("");
  const [kodeMk, setKodeMk] = useState("");
  const [namaMk, setNamaMk] = useState("");
  const [sks, setSks] = useState<number>(3);

  const [modeDosen, setModeDosen] = useState<"EXISTING" | "NEW">("EXISTING");
  const [dosenId, setDosenId] = useState("");
  const [namaDosen, setNamaDosen] = useState("");

  const [kodeKelas, setKodeKelas] = useState("");
  const [semesterId, setSemesterId] = useState(defaultSemesterId || semesters[0]?.id || "");
  const [jadwalHari, setJadwalHari] = useState("Senin");
  const [jadwalJam, setJadwalJam] = useState("08:00 - 09:40");
  const [ruangan, setRuangan] = useState("");
  const [modePembelajaran, setModePembelajaran] = useState<"DARING" | "LURING" | "BIMBINGAN">("DARING");

  const [loading, setLoading] = useState(false);

  function openCreateModal() {
    setEditingKelas(null);
    const defaultProdi = prodiList[0]?.id || "";
    setProdiId(defaultProdi);

    const mksInProdi = allMkList.filter((m) => m.prodi?.id === defaultProdi);
    setModeMk(mksInProdi.length > 0 ? "EXISTING" : "NEW");
    setMataKuliahId(mksInProdi[0]?.id || allMkList[0]?.id || "");
    setKodeMk("");
    setNamaMk("");
    setSks(3);

    const dosensInProdi = allDosenList.filter((d) => !d.prodi?.id || d.prodi?.id === defaultProdi);
    setModeDosen(dosensInProdi.length > 0 ? "EXISTING" : "NEW");
    setDosenId(dosensInProdi[0]?.id || allDosenList[0]?.id || "");
    setNamaDosen("");

    setKodeKelas("");
    setSemesterId(selectedSemester !== "ALL" ? selectedSemester : defaultSemesterId || semesters[0]?.id || "");
    setJadwalHari("Senin");
    setJadwalJam("08:00 - 09:40");
    setRuangan("");
    setModePembelajaran("DARING");
    setIsModalOpen(true);
  }

  function openEditModal(cls: KelasItem) {
    setEditingKelas(cls);
    setProdiId(cls.mataKuliah.prodi.id);

    setModeMk("EXISTING");
    setMataKuliahId(cls.mataKuliahId);
    setKodeMk(cls.mataKuliah.kode);
    setNamaMk(cls.mataKuliah.nama);
    setSks(cls.mataKuliah.sks);

    setModeDosen("EXISTING");
    setDosenId(cls.dosenId);
    setNamaDosen(cls.dosen.nama);

    setKodeKelas(cls.kodeKelas);
    setSemesterId(cls.semesterId);
    setJadwalHari(cls.jadwalHari || "Senin");
    setJadwalJam(cls.jadwalJam || "08:00 - 09:40");
    setRuangan(cls.ruangan || "");
    setModePembelajaran(cls.modePembelajaran || "DARING");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingKelas(null);
  }

  async function handleReloadData(semId?: string) {
    const res = await getKelasList(semId || selectedSemester);
    if (res.success && res.data) {
      setKelasList(res.data.kelas as any);
      setAllMkList(res.data.mataKuliah as any);
      setAllDosenList(res.data.dosen as any);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        kodeKelas: kodeKelas.trim().toUpperCase(),
        semesterId,
        jadwalHari,
        jadwalJam,
        ruangan: modePembelajaran === "LURING" ? ruangan.trim() : null,
        modePembelajaran,
        mataKuliahId: modeMk === "EXISTING" ? mataKuliahId : undefined,
        kodeMk: modeMk === "NEW" ? kodeMk.trim().toUpperCase() : undefined,
        namaMk: modeMk === "NEW" ? namaMk.trim() : undefined,
        sks: modeMk === "NEW" ? Number(sks) || 3 : undefined,
        prodiId,
        dosenId: modeDosen === "EXISTING" ? dosenId : undefined,
        namaDosen: modeDosen === "NEW" ? namaDosen.trim() : undefined,
      };

      if (editingKelas) {
        const res = await updateKelas(editingKelas.id, payload);
        if (!res.success) {
          toast.error(res.error || "Gagal memperbarui data kelas");
        } else {
          toast.success("Data perkuliahan berhasil diperbarui");
          closeModal();
          await handleReloadData();
        }
      } else {
        const res = await createKelas(payload);
        if (!res.success) {
          toast.error(res.error || "Gagal menambah data perkuliahan");
        } else {
          toast.success("Data perkuliahan & 16 sesi monitoring berhasil dibuat!");
          closeModal();
          await handleReloadData();
        }
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, kode: string, namaMk: string) {
    if (!confirm(`Hapus perkuliahan kelas "${kode}" (${namaMk}) beserta 16 sesi monitoringnya?`)) return;

    const res = await deleteKelas(id);
    if (!res.success) {
      toast.error(res.error || "Gagal menghapus kelas");
    } else {
      toast.success("Data perkuliahan berhasil dihapus");
      setKelasList((prev) => prev.filter((k) => k.id !== id));
    }
  }

  // Filter list
  const filteredKelas = kelasList.filter((k) => {
    const matchSemester = selectedSemester === "ALL" || k.semesterId === selectedSemester;
    const matchProdi = filterProdi === "ALL" || k.mataKuliah.prodi.id === filterProdi;
    const matchHari = filterHari === "ALL" || k.jadwalHari?.toLowerCase() === filterHari.toLowerCase();
    const matchMode = filterMode === "ALL" || k.modePembelajaran === filterMode;
    const matchSearch =
      k.kodeKelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.mataKuliah.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.mataKuliah.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.dosen.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.mataKuliah.prodi.nama.toLowerCase().includes(searchQuery.toLowerCase());

    return matchSemester && matchProdi && matchHari && matchMode && matchSearch;
  });

  // Mata kuliah yang sesuai dengan prodi yang dipilih di modal
  const filteredMkOptions = allMkList.filter(
    (m) => !prodiId || m.prodi?.id === prodiId
  );

  // Dosen yang sesuai dengan prodi yang dipilih di modal
  const filteredDosenOptions = allDosenList.filter(
    (d) => !prodiId || !d.prodi?.id || d.prodi?.id === prodiId
  );

  return (
    <div className="space-y-4">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <School size={20} className="text-[#a80063]" />
            <span>Data Master Perkuliahan</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Kelola Mata Kuliah, Dosen Pengampu, Kelas & Jadwal secara terpadu. Setiap kelas baru otomatis dibuatkan 16 sesi monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* <button
            onClick={() => generateTemplate("kelas")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold transition-all cursor-pointer"
            title="Download Template Format Kurikulum (.xlsx)"
          >
            <Download size={13} />
            <span>Unduh Format Excel</span>
          </button> */}

          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Import Excel</span>
          </button>

          <button
            onClick={openCreateModal}
            className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Perkuliahan</span>
          </button>
        </div>
      </div>

      {/* ── Filter Controls Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        {/* Search */}
        <div className="relative w-full lg:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari MK, Dosen, Kelas, atau Prodi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Semester */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Semester:</span>
            <select
              value={selectedSemester}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                handleReloadData(e.target.value);
              }}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[155px] truncate"
            >
              <option value="ALL">Semua Semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tahunAkademik} ({s.periode}) {s.aktif ? "★ Aktif" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Prodi */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Prodi:</span>
            <select
              value={filterProdi}
              onChange={(e) => setFilterProdi(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none max-w-[150px] truncate"
            >
              <option value="ALL">Semua Prodi</option>
              {prodiList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} ({p.kode})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Hari */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Hari:</span>
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua Hari</option>
              {HARI_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Mode */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-medium">Mode:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="px-2 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
            >
              <option value="ALL">Semua Mode</option>
              <option value="DARING">Online (Daring)</option>
              <option value="LURING">Offline (Luring)</option>
              <option value="BIMBINGAN">Bimbingan (SCP/Skripsi)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Kode MK</th>
                <th className="pb-2.5 font-bold">Mata Kuliah</th>
                <th className="pb-2.5 font-bold">Program Studi</th>
                <th className="pb-2.5 font-bold">Kelas</th>
                <th className="pb-2.5 font-bold">Pengajar (Dosen)</th>
                <th className="pb-2.5 font-bold">Jadwal</th>
                <th className="pb-2.5 font-bold">Ruang Kelas</th>
                <th className="pb-2.5 font-bold">Mode</th>
                <th className="pb-2.5 font-bold">Monitoring</th>
                <th className="pb-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredKelas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-slate-400">
                    Belum ada data perkuliahan yang sesuai dengan filter. Klik "Tambah Perkuliahan" atau "Import Excel" untuk menambahkan data.
                  </td>
                </tr>
              ) : (
                filteredKelas.map((k) => {
                  const filledSessions = k.monitoringSesi?.filter(
                    (s) => s.kehadiran !== "BELUM_DIISI"
                  ).length || 0;

                  return (
                    <tr key={k.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Kode MK */}
                      <td className="py-3 pr-3 font-mono font-bold text-xs">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                          {k.mataKuliah.kode}
                        </span>
                      </td>

                      {/* Mata Kuliah & SKS */}
                      <td className="py-3 pr-3">
                        <p className="font-bold text-xs text-slate-900 leading-tight">
                          {k.mataKuliah.nama}
                        </p>
                        <div className="mt-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                            {k.mataKuliah.sks} SKS
                          </span>
                        </div>
                      </td>

                      {/* Program Studi */}
                      <td className="py-3 pr-3">
                        <span className="font-semibold text-xs text-slate-800">
                          {k.mataKuliah.prodi.nama}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Kode: {k.mataKuliah.prodi.kode}
                        </p>
                      </td>

                      {/* Nama Kelas */}
                      <td className="py-3 pr-3 font-bold">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] text-xs font-extrabold shadow-2xs">
                          {k.kodeKelas}
                        </span>
                      </td>

                      {/* Dosen Pengampu */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] shrink-0">
                            {k.dosen.nama[0]}
                          </div>
                          <span className="font-medium text-xs text-slate-800">
                            {k.dosen.nama}
                          </span>
                        </div>
                      </td>

                      {/* Jadwal Hari & Jam */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span>
                            <strong>{k.jadwalHari}</strong>, {k.jadwalJam}
                          </span>
                        </div>
                      </td>

                      {/* Ruang Kelas (Opsional untuk Offline/Luring) */}
                      <td className="py-3 pr-3">
                        {k.modePembelajaran === "LURING" ? (
                          k.ruangan ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs">
                              <DoorClosed size={12} className="text-[#a80063] shrink-0" />
                              <span>{k.ruangan}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Belum diatur
                            </span>
                          )
                        ) : (
                          <span className="text-xs text-slate-300 font-medium select-none" title="Kelas Online tidak memerlukan ruang fisik">
                            —
                          </span>
                        )}
                      </td>

                      {/* Mode Pembelajaran */}
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                            k.modePembelajaran === "BIMBINGAN"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : k.modePembelajaran === "LURING"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {k.modePembelajaran === "BIMBINGAN" ? (
                            <>
                              <GraduationCap size={10} />
                              <span>Bimbingan</span>
                            </>
                          ) : k.modePembelajaran === "LURING" ? (
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
                      </td>

                      {/* Progress Sesi Monitoring */}
                      <td className="py-3 pr-3 min-w-[120px]">
                        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-0.5">
                          <span>{filledSessions}/16 Sesi</span>
                          <span>{Math.round((filledSessions / 16) * 100)}%</span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#a80063] to-[#c026d3] rounded-full transition-all duration-300"
                            style={{ width: `${(filledSessions / 16) * 100}%` }}
                          />
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href="/monitoring"
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all"
                            title="Buka Lembar Monitoring"
                          >
                            <ArrowUpRight size={13} />
                          </Link>
                          <button
                            onClick={() => openEditModal(k)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Perkuliahan"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(k.id, k.kodeKelas, k.mataKuliah.nama)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Hapus Perkuliahan"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Unified Add / Edit Modal (1-Window Form) ─────────────────────────── */}
      {mounted && isModalOpen && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <School size={16} className="text-[#a80063]" />
              <span>{editingKelas ? "Edit Data Perkuliahan" : "Tambah Perkuliahan Baru"}</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Formulir terpadu: isi Mata Kuliah, Dosen Pengampu, Nama Kelas, dan Jadwal secara langsung.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Program Studi & Semester */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Program Studi <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={prodiId}
                    onChange={(e) => {
                      const newProdi = e.target.value;
                      setProdiId(newProdi);
                      const mks = allMkList.filter((m) => m.prodi?.id === newProdi);
                      if (mks.length > 0) {
                        setMataKuliahId(mks[0].id);
                        setModeMk("EXISTING");
                      }
                      const dosens = allDosenList.filter((d) => !d.prodi?.id || d.prodi?.id === newProdi);
                      if (dosens.length > 0) {
                        setDosenId(dosens[0].id);
                        setModeDosen("EXISTING");
                      }
                    }}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  >
                    {prodiList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({p.kode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Semester <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  >
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tahunAkademik} ({s.periode}) {s.aktif ? "★ Aktif" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Section: Mata Kuliah ───────────────────────────── */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={13} className="text-[#a80063]" />
                    <span>Mata Kuliah</span>
                  </span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setModeMk("EXISTING")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        modeMk === "EXISTING"
                          ? "bg-[#fdf2f8] text-[#a80063]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Pilih Terdaftar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeMk("NEW")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        modeMk === "NEW"
                          ? "bg-[#fdf2f8] text-[#a80063]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      + Buat Baru
                    </button>
                  </div>
                </div>

                {modeMk === "EXISTING" ? (
                  <div>
                    <select
                      value={mataKuliahId}
                      onChange={(e) => setMataKuliahId(e.target.value)}
                      required={modeMk === "EXISTING"}
                      className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    >
                      {filteredMkOptions.length === 0 ? (
                        <option value="">-- Belum ada MK di prodi ini, klik '+ Buat Baru' --</option>
                      ) : (
                        filteredMkOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.kode}] {m.nama} ({m.sks} SKS)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 gap-2 animate-fade-in">
                    <div className="col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Kode MK
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 25AK11001"
                        value={kodeMk}
                        onChange={(e) => setKodeMk(e.target.value.toUpperCase())}
                        required={modeMk === "NEW"}
                        className="w-full px-2.5 py-1.5 bg-white text-xs font-mono font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Nama Mata Kuliah
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pengantar Manajemen"
                        value={namaMk}
                        onChange={(e) => setNamaMk(e.target.value)}
                        required={modeMk === "NEW"}
                        className="w-full px-2.5 py-1.5 bg-white text-xs font-medium text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        SKS
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={sks}
                        onChange={(e) => setSks(parseInt(e.target.value) || 2)}
                        required={modeMk === "NEW"}
                        className="w-full px-2.5 py-1.5 bg-white text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Section: Dosen Pengampu ───────────────────────── */}
              <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={13} className="text-[#a80063]" />
                    <span>Pengajar (Dosen)</span>
                  </span>
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setModeDosen("EXISTING")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        modeDosen === "EXISTING"
                          ? "bg-[#fdf2f8] text-[#a80063]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Pilih Terdaftar
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeDosen("NEW")}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        modeDosen === "NEW"
                          ? "bg-[#fdf2f8] text-[#a80063]"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      + Buat Baru
                    </button>
                  </div>
                </div>

                {modeDosen === "EXISTING" ? (
                  <div>
                    <select
                      value={dosenId}
                      onChange={(e) => setDosenId(e.target.value)}
                      required={modeDosen === "EXISTING"}
                      className="w-full px-3 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    >
                      {filteredDosenOptions.length === 0 ? (
                        <option value="">-- Belum ada Dosen di prodi ini, klik '+ Buat Baru' --</option>
                      ) : (
                        filteredDosenOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nama} {d.prodi ? `(${d.prodi.kode})` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Nama Lengkap & Gelar Dosen
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Julhan Abdul Malik, S.Kom"
                      value={namaDosen}
                      onChange={(e) => setNamaDosen(e.target.value)}
                      required={modeDosen === "NEW"}
                      className="w-full px-3 py-1.5 bg-white text-xs font-semibold text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* ── Section: Nama Kelas, Jadwal & Mode ─────────────── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Nama Kelas */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nama / Kode Kelas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: AK26A, TI26A"
                    value={kodeKelas}
                    onChange={(e) => setKodeKelas(e.target.value.toUpperCase())}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] focus:ring-1 focus:ring-[#a80063]/20 outline-none font-bold"
                  />
                </div>

                {/* Hari Perkuliahan */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Hari Perkuliahan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={jadwalHari}
                    onChange={(e) => setJadwalHari(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  >
                    {HARI_OPTIONS.map((hari) => (
                      <option key={hari} value={hari}>
                        {hari}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Jam Perkuliahan */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Jam Perkuliahan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 09:10 s.d 10:50"
                    value={jadwalJam}
                    onChange={(e) => setJadwalJam(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                </div>

                {/* Mode Pembelajaran */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Mode Pembelajaran
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setModePembelajaran("DARING")}
                      className={`py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        modePembelajaran === "DARING"
                          ? "bg-white text-blue-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Laptop size={12} />
                      <span>Online</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModePembelajaran("LURING")}
                      className={`py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        modePembelajaran === "LURING"
                          ? "bg-white text-emerald-600 shadow-xs"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Building size={12} />
                      <span>Offline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModePembelajaran("BIMBINGAN")}
                      className={`py-1 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        modePembelajaran === "BIMBINGAN"
                          ? "bg-white text-purple-700 shadow-xs"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <GraduationCap size={12} />
                      <span>Bimbingan</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Ruang Kelas & Keterangan Mode */}
              {modePembelajaran === "LURING" ? (
                <div className="animate-fade-in">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DoorClosed size={13} className="text-[#a80063]" />
                      <span>Ruang Kelas <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span></span>
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium">Khusus Tatap Muka</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: R.301, Lab Komputer 2, Gedung B lt.2"
                    value={ruangan}
                    onChange={(e) => setRuangan(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-medium"
                  />
                </div>
              ) : modePembelajaran === "BIMBINGAN" ? (
                <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-100 text-[11px] text-purple-800 space-y-1 animate-fade-in">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap size={13} className="shrink-0 text-purple-600" />
                    <span>Kelas Bimbingan (SCP / Skripsi)</span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-[11px] text-blue-700 flex items-center gap-2 animate-fade-in">
                  <Laptop size={13} className="shrink-0 text-blue-500" />
                  <span>Perkuliahan Online dilaksanakan melalui Edlink / LMS (tanpa ruang kelas fisik).</span>
                </div>
              )}

              {/* Info Sesi Otomatis */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-start gap-2">
                <Sparkles size={14} className="text-[#a80063] shrink-0 mt-0.5" />
                <span>
                  <strong>16 Sesi Monitoring otomatis:</strong> Sesi 1–7 & 9–15 (Reguler), Sesi 8 (UTS) dan Sesi 16 (UAS). Langsung siap dipantau di lembar monitoring.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  <span>{editingKelas ? "Simpan Perubahan" : "Tambah Perkuliahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Bulk Import Modal ─────────────────────────────────────────────────── */}
      <MasterImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Data Perkuliahan dari Excel (Format Kurikulum)"
        type="kelas"
        parseAction={parseKelasExcel}
        commitAction={commitKelasImport}
        onSuccess={async () => {
          await handleReloadData();
        }}
      />
    </div>
  );
}

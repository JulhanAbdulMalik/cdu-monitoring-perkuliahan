"use client";
// src/components/master/MasterImportModal.tsx
// Universal Master Data Excel Import Modal with Interactive Preview & In-Line Edit
// Plus Jakarta Sans & #a80063 Theme

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Calendar,
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Sparkles,
  Edit2,
  Trash2,
  Search,
  RotateCcw,
  Check,
} from "lucide-react";
import { generateTemplate } from "@/lib/template-generator";
import { ImportPreviewResult, ImportPreviewRow } from "@/actions/master-import";

interface ProdiOption {
  id: string;
  nama: string;
  kode: string;
}

interface SemesterOption {
  id: string;
  tahunAkademik: string;
  periode: string;
  aktif: boolean;
}

interface MasterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: "dosen" | "mata-kuliah" | "kelas" | "prodi" | "semester";
  prodiList?: ProdiOption[];
  semesterList?: SemesterOption[];
  defaultSemesterId?: string;
  parseAction: (formData: FormData) => Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }>;
  commitAction: (rows: any[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  onSuccess: () => void;
}

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export default function MasterImportModal({
  isOpen,
  onClose,
  title,
  type,
  prodiList = [],
  semesterList = [],
  defaultSemesterId = "",
  parseAction,
  commitAction,
  onSuccess,
}: MasterImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);

  // Selected Target Semester for Kelas import
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>(
    defaultSemesterId || semesterList?.find((s) => s.aktif)?.id || semesterList?.[0]?.id || ""
  );

  useEffect(() => {
    if (defaultSemesterId) {
      setSelectedSemesterId(defaultSemesterId);
    } else if (semesterList && semesterList.length > 0) {
      const active = semesterList.find((s) => s.aktif) || semesterList[0];
      setSelectedSemesterId(active.id);
    }
  }, [defaultSemesterId, semesterList]);

  function handleSemesterChange(newSemesterId: string) {
    setSelectedSemesterId(newSemesterId);
    const chosenSem = semesterList?.find((s) => s.id === newSemesterId);
    if (!chosenSem || !previewResult) return;

    const updated = previewResult.previewList.map((r) => ({
      ...r,
      data: {
        ...r.data,
        semesterId: chosenSem.id,
        semesterTahun: `${chosenSem.tahunAkademik} (${chosenSem.periode})`,
      },
    }));

    setPreviewResult({
      ...previewResult,
      previewList: updated,
    });
  }

  // Filter & Search di Pratinjau
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "invalid">("all");

  // In-line / Modal Row Edit State
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter daftar baris (useMemo sebelum if (!isOpen || !mounted))
  const filteredPreviewList = useMemo(() => {
    if (!previewResult?.previewList) return [];
    return previewResult.previewList.filter((r) => {
      if (statusFilter === "valid" && !r.isValid) return false;
      if (statusFilter === "invalid" && r.isValid) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const dataString = JSON.stringify(r.data).toLowerCase();
      return dataString.includes(q);
    });
  }, [previewResult, statusFilter, searchQuery]);

  if (!isOpen || !mounted) return null;

  function handleDownloadTemplate() {
    generateTemplate(type);
    toast.success(`Template ${type.toUpperCase()} berhasil diunduh!`);
  }

  async function handleFileSelect(selectedFile: File) {
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Format file harus .xlsx, .xls, atau .csv");
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setPreviewResult(null);
    setSearchQuery("");
    setStatusFilter("all");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (selectedSemesterId) {
        formData.append("semesterId", selectedSemesterId);
      }

      const res = await parseAction(formData);
      if (!res.success || !res.data) {
        toast.error(res.error || "Gagal memproses file Excel");
      } else {
        toast.success(`File berhasil dibaca (${res.data.totalRows} baris ditemukan)`);
        setPreviewResult(res.data);
      }
    } catch {
      toast.error("Terjadi kesalahan saat memproses file");
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  // Buka form edit untuk baris tertentu
  function handleStartEdit(row: ImportPreviewRow) {
    setEditingRowIndex(row.rowIndex);
    const d = { ...row.data };

    // Bersihkan nilai dummy "-" agar form edit terisi nilai yang bersih dan valid
    if (!d.jadwalHari || d.jadwalHari === "-") {
      d.jadwalHari = d.modePembelajaran === "BIMBINGAN" ? "Jumat" : "Senin";
    }
    if (!d.jadwalJam || d.jadwalJam === "-") {
      d.jadwalJam = "08:00 - 09:40";
    }
    if (!d.dosenNama || d.dosenNama === "-") {
      d.dosenNama = d.dosenQuery && d.dosenQuery !== "-" ? d.dosenQuery : "";
    }
    if (d.dosenQuery === "-") {
      d.dosenQuery = "";
    }

    setEditFormData(d);
  }

  // Simpan perubahan edit baris ke state pratinjau
  function handleSaveEdit() {
    if (!previewResult || editingRowIndex === null) return;

    const updatedList = previewResult.previewList.map((r) => {
      if (r.rowIndex !== editingRowIndex) return r;

      const newData = { ...r.data, ...editFormData };

      // Pastikan nama dosen dan query tersinkronisasi
      if (newData.dosenNama && !newData.dosenQuery) {
        newData.dosenQuery = newData.dosenNama;
      }
      if (newData.dosenQuery && !newData.dosenNama) {
        newData.dosenNama = newData.dosenQuery;
      }

      // Pastikan mataKuliahNama terupdate jika kode atau nama MK diedit
      if (newData.kodeMk || newData.namaMk) {
        newData.mataKuliahNama = newData.kodeMk
          ? `${newData.kodeMk} - ${newData.namaMk || ""}`
          : newData.namaMk;
      }

      // Normalisasi jadwal & dosen
      const cleanHari = String(newData.jadwalHari || "").trim();
      const cleanJam = String(newData.jadwalJam || "").trim();
      const cleanDosen = String(newData.dosenNama || newData.dosenQuery || "").trim();

      newData.jadwalHari = cleanHari && cleanHari !== "-" ? cleanHari : "-";
      newData.jadwalJam = cleanJam && cleanJam !== "-" ? cleanJam : "-";
      newData.dosenNama = cleanDosen && cleanDosen !== "-" ? cleanDosen : "-";
      newData.dosenQuery = cleanDosen && cleanDosen !== "-" ? cleanDosen : "";

      const errors: string[] = [];

      // Validasi ulang sesuai type
      if (type === "kelas") {
        if (!newData.kodeKelas?.trim()) errors.push("Nama / Kode Kelas wajib diisi");
        if (!newData.kodeMk?.trim() && !newData.namaMk?.trim()) errors.push("Kode atau Nama MK wajib diisi");
        if (!cleanDosen || cleanDosen === "-") {
          errors.push("Pengajar / Dosen belum diisi");
        }
        if (!cleanHari || cleanHari === "-" || !cleanJam || cleanJam === "-") {
          errors.push("Jadwal mingguan belum diisi");
        }
        if (!newData.prodiNama?.trim() && !newData.prodiQuery?.trim()) {
          errors.push("Program Studi wajib diisi");
        }
      } else if (type === "dosen") {
        if (!newData.nama?.trim()) errors.push("Nama dosen wajib diisi");
        if (!newData.kodeProdi?.trim()) errors.push("Kode prodi wajib diisi");
      } else if (type === "mata-kuliah") {
        if (!newData.kode?.trim()) errors.push("Kode MK wajib diisi");
        if (!newData.nama?.trim()) errors.push("Nama MK wajib diisi");
      }

      return {
        ...r,
        data: newData,
        isValid: errors.length === 0,
        errors,
      };
    });

    const validRows = updatedList.filter((r) => r.isValid).length;
    const invalidRows = updatedList.filter((r) => !r.isValid).length;

    setPreviewResult({
      totalRows: updatedList.length,
      validRows,
      invalidRows,
      previewList: updatedList,
    });

    setEditingRowIndex(null);
    setEditFormData({});
    toast.success("Perubahan data baris berhasil disimpan!");
  }

  // Hapus baris dari daftar pratinjau
  function handleDeleteRow(rowIndex: number) {
    if (!previewResult) return;

    const updatedList = previewResult.previewList.filter((r) => r.rowIndex !== rowIndex);
    const validRows = updatedList.filter((r) => r.isValid).length;
    const invalidRows = updatedList.filter((r) => !r.isValid).length;

    setPreviewResult({
      totalRows: updatedList.length,
      validRows,
      invalidRows,
      previewList: updatedList,
    });

    toast.success(`Baris #${rowIndex} dihapus dari daftar import`);
  }

  // Reset file untuk unggah ulang
  function handleResetFile() {
    setFile(null);
    setPreviewResult(null);
    setSearchQuery("");
    setStatusFilter("all");
    setEditingRowIndex(null);
  }

  // Eksekusi Import ke Database
  async function handleCommit() {
    if (!previewResult || previewResult.validRows === 0) {
      toast.error("Tidak ada baris data valid untuk diimport");
      return;
    }

    setCommitting(true);
    try {
      const validData = previewResult.previewList
        .filter((r) => r.isValid)
        .map((r) => r.data);

      const res = await commitAction(validData);
      if (!res.success) {
        toast.error(res.error || "Gagal mengimport data ke database");
      } else {
        toast.success(`Berhasil mengimport ${res.count} data perkuliahan!`);
        onSuccess();
        handleClose();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan");
    } finally {
      setCommitting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setPreviewResult(null);
    setSearchQuery("");
    setStatusFilter("all");
    setEditingRowIndex(null);
    onClose();
  }

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !committing) handleClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        className={`w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[94vh] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          previewResult ? "max-w-5xl lg:max-w-6xl xl:max-w-7xl" : "max-w-xl"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={committing}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30 transition-colors"
          title="Tutup Modal (ESC)"
        >
          <X size={18} />
        </button>

        {/* Modal Header Standar CDU Portal */}
        <div className="mb-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#a80063]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            {previewResult
              ? "Pratinjau Data Master • Silakan tinjau dan koreksi data sebelum disimpan ke database"
              : "Format berkas .xlsx, .xls, atau .csv • Mendukung ekspor tabel SIAKAD maupun template bawaan"}
          </p>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {!previewResult ? (
            /* ── VIEW 1: UPLOAD & DOWNLOAD TEMPLATE ────────────────────────── */
            <div className="space-y-3.5 overflow-y-auto pr-1 py-1">
              
              {/* Semester Destination Selector (Khusus Data Perkuliahan) */}
              {type === "kelas" && semesterList && semesterList.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-[#a80063]" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Semester Tujuan Impor</p>
                    </div>
                  </div>
                  <select
                    value={selectedSemesterId}
                    onChange={(e) => handleSemesterChange(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#a80063] cursor-pointer"
                  >
                    {semesterList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.tahunAkademik} ({s.periode}) {s.aktif ? "• Aktif" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !parsing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  parsing
                    ? "border-slate-300 bg-slate-50 cursor-wait"
                    : "border-slate-300 hover:border-[#a80063]/50 hover:bg-slate-50/60 cursor-pointer"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  disabled={parsing}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  }}
                />

                {parsing ? (
                  <div className="py-4 flex flex-col items-center justify-center space-y-3">
                    <Loader2 size={32} className="animate-spin text-[#a80063]" />
                    <p className="text-xs font-bold text-slate-800">
                      Menganalisis & membaca berkas Excel...
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Smart parser sedang mengekstrak Kode MK, Jadwal, Dosen & Prodi.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mx-auto mb-3">
                      <UploadCloud size={22} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">
                        Pilih atau Seret Berkas {title} ke Sini
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Format berkas <strong>.xlsx</strong>, <strong>.xls</strong>, atau <strong>.csv</strong> (SIAKAD maupun Template Bawaan)
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Template Download Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-[#a80063]" />
                  <span className="text-xs text-slate-700">Belum memiliki format berkas yang sesuai?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer"
                >
                  <Download size={12} />
                  <span>Unduh Template {type.toUpperCase()}</span>
                </button>
              </div>

              {/* Info Ekstraksi Ringkas */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500">
                <Sparkles size={13} className="text-[#a80063] shrink-0" />
                <span>
                  Dilengkapi smart parser: mendeteksi otomatis kolom header, mencocokkan data relasi, dan memvalidasi sebelum disimpan.
                </span>
              </div>
            </div>
          ) : (
            /* ── VIEW 2: INTERACTIVE PREVIEW & EDIT TABLE ───────────────────── */
            <div className="flex-1 flex flex-col overflow-hidden space-y-3.5 animate-fade-in">
              {/* Baris Kontrol: Search, Filter & Badges Status (Compact 1 Baris) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari data di preview..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#a80063] transition-colors"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="py-1.5 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:outline-none focus:border-[#a80063] cursor-pointer"
                  >
                    <option value="all">Semua ({previewResult.totalRows})</option>
                    <option value="valid">Siap ({previewResult.validRows})</option>
                    {previewResult.invalidRows > 0 && (
                      <option value="invalid">Bermasalah ({previewResult.invalidRows})</option>
                    )}
                  </select>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  {type === "kelas" && semesterList && semesterList.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs">
                      <Calendar size={12} className="text-[#a80063]" />
                      <span className="text-slate-500 text-[11px]">Semester:</span>
                      <select
                        value={selectedSemesterId}
                        onChange={(e) => handleSemesterChange(e.target.value)}
                        className="text-xs font-bold text-[#a80063] bg-transparent outline-none cursor-pointer"
                      >
                        {semesterList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.tahunAkademik} ({s.periode}) {s.aktif ? "• Aktif" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                    <span>Total: <strong>{previewResult.totalRows} Baris</strong></span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Siap: <strong>{previewResult.validRows}</strong></span>
                  </div>
                  {previewResult.invalidRows > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                      <AlertTriangle size={12} className="text-rose-600" />
                      <span>Perlu Periksa: <strong>{previewResult.invalidRows}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Table Container */}
              <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white shadow-2xs max-h-[55vh] lg:max-h-[60vh]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600 tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      {type === "kelas" && (
                        <>
                          <th className="py-2.5 px-3 w-24">Kelas</th>
                          <th className="py-2.5 px-3">Mata Kuliah & SKS</th>
                          <th className="py-2.5 px-3">Program Studi</th>
                          <th className="py-2.5 px-3">Pengajar / Dosen</th>
                          <th className="py-2.5 px-3">Jadwal Perkuliahan</th>
                          <th className="py-2.5 px-3">Ruang & Mode</th>
                        </>
                      )}
                      {type === "dosen" && (
                        <>
                          <th className="py-2.5 px-3">Nama Dosen & Gelar</th>
                          <th className="py-2.5 px-3">NIP</th>
                          <th className="py-2.5 px-3">NIDN</th>
                          <th className="py-2.5 px-3">NUPTK</th>
                          <th className="py-2.5 px-3">Email</th>
                          <th className="py-2.5 px-3">Program Studi</th>
                        </>
                      )}
                      {type === "mata-kuliah" && (
                        <>
                          <th className="py-2.5 px-3">Kode MK</th>
                          <th className="py-2.5 px-3">Nama Mata Kuliah</th>
                          <th className="py-2.5 px-3">SKS</th>
                          <th className="py-2.5 px-3">Program Studi</th>
                        </>
                      )}
                      <th className="py-2.5 px-3 text-center w-28">Status</th>
                      <th className="py-2.5 px-3 text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Tidak ada baris data yang cocok dengan filter pencarian
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewList.map((row, index) => (
                        <tr
                          key={row.rowIndex}
                          className={`transition-colors ${
                            row.isValid ? "hover:bg-slate-50/80" : "bg-rose-50/40 hover:bg-rose-50/70"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500 text-xs">
                            {index + 1}
                          </td>

                          {type === "kelas" && (
                            <>
                              <td className="py-2.5 px-3 font-bold text-[#a80063]">
                                {row.data.kodeKelas}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                  <span>{row.data.namaMk || row.data.mataKuliahNama}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium">
                                  Kode: <strong className="text-slate-700">{row.data.kodeMk || "-"}</strong> • {row.data.sks || 3} SKS
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                  {row.data.prodiNama || row.data.prodiQuery || "-"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {row.data.dosenNama && row.data.dosenNama !== "-" ? (
                                  <div>
                                    <span>{row.data.dosenNama}</span>
                                    {row.data.dosen2Nama && row.data.dosen2Nama !== "-" && (
                                      <div className="mt-0.5">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold">
                                          {row.data.dosen2Nama}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-amber-700 font-semibold text-[11px] italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Belum ada Dosen
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-[11px] text-slate-600">
                                {row.data.jadwalHari && row.data.jadwalHari !== "-" && row.data.jadwalJam && row.data.jadwalJam !== "-" ? (
                                  <>
                                    <span className="font-semibold text-slate-700">{row.data.jadwalHari}</span>, {row.data.jadwalJam}
                                  </>
                                ) : (
                                  <span className="text-amber-700 font-semibold text-[11px] italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    Belum ada Jadwal
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                      row.data.modePembelajaran === "LURING"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                                        : row.data.modePembelajaran === "BIMBINGAN"
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                  >
                                    {row.data.modePembelajaran === "LURING" ? "Offline" : row.data.modePembelajaran === "BIMBINGAN" ? "Bimbingan" : "Online"}
                                  </span>
                                  {row.data.ruangan && (
                                    <span className="font-semibold text-slate-700">@{row.data.ruangan}</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          {type === "dosen" && (
                            <>
                              <td className="py-2.5 px-3 font-bold text-slate-800">{row.data.nama}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.data.nip || "-"}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.data.nidn || "-"}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.data.nuptk || "-"}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{row.data.email || "-"}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">{row.data.kodeProdi || row.data.prodiNama}</td>
                            </>
                          )}

                          {type === "mata-kuliah" && (
                            <>
                              <td className="py-2.5 px-3 font-bold text-[#a80063]">{row.data.kode}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">{row.data.nama}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-700">{row.data.sks} SKS</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">{row.data.kodeProdi || row.data.prodiNama}</td>
                            </>
                          )}

                          {/* Status Validasi */}
                          <td className="py-2.5 px-3 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <Check size={10} /> Siap
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 cursor-help"
                                title={row.errors.join("; ")}
                              >
                                <AlertTriangle size={10} /> {row.errors[0]}
                              </span>
                            )}
                          </td>

                          {/* Tombol Aksi Edit & Hapus */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(row)}
                                className="p-1 rounded-md text-slate-500 hover:text-[#a80063] hover:bg-slate-100 cursor-pointer transition-colors"
                                title="Edit Baris Ini"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.rowIndex)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                title="Hapus dari Daftar Impor"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Catatan Kaki Standar */}
              <p className="text-[11px] text-amber-700 italic pt-1">
                * Catatan: Baris yang siap import (bertanda hijau) akan disimpan ke database master. Anda dapat melakukan koreksi baris atau menghapus data sebelum menyetujui.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4 shrink-0">
          {previewResult ? (
            /* State: Sedang Preview (Belum Disimpan) */
            <>
              <button
                type="button"
                onClick={handleResetFile}
                disabled={committing}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                <span>Batal / Ganti Berkas</span>
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || previewResult.validRows === 0}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {committing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Simpan ke Database ({previewResult.validRows} Baris)</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* State: Belum Diproses */
            <button
              type="button"
              onClick={handleClose}
              disabled={parsing}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              Batal
            </button>
          )}
        </div>

        {/* ── SUB-MODAL QUICK EDIT ROW ─────────────────────────────────────── */}
        {editingRowIndex !== null && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 size={15} className="text-[#a80063]" />
                  <span>Koreksi & Edit Data Perkuliahan</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingRowIndex(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {type === "kelas" && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama / Kode Kelas</label>
                      <input
                        type="text"
                        value={editFormData.kodeKelas || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, kodeKelas: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-[#a80063] focus:outline-none focus:border-[#a80063]"
                        placeholder="GZ26A"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Program Studi</label>
                      {prodiList && prodiList.length > 0 ? (
                        <select
                          value={
                            prodiList.find(
                              (p) =>
                                p.id === editFormData.prodiId ||
                                p.nama.toLowerCase() === (editFormData.prodiNama || "").toLowerCase() ||
                                p.nama.toLowerCase() === (editFormData.prodiQuery || "").toLowerCase() ||
                                p.nama.toLowerCase() === (editFormData.prodiQuery || "").replace(/^(S[1-3]|D[3-4])\s*[-–—]?\s*/i, "").trim().toLowerCase()
                            )?.nama || editFormData.prodiNama || ""
                          }
                          onChange={(e) => {
                            const selected = prodiList.find((p) => p.nama === e.target.value);
                            setEditFormData({
                              ...editFormData,
                              prodiNama: e.target.value,
                              prodiQuery: e.target.value,
                              prodiId: selected?.id || editFormData.prodiId,
                            });
                          }}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#a80063]"
                        >
                          <option value="">-- Pilih Program Studi --</option>
                          {prodiList.map((p) => (
                            <option key={p.id} value={p.nama}>
                              {p.nama} ({p.kode})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={editFormData.prodiNama || editFormData.prodiQuery || ""}
                          onChange={(e) => setEditFormData({ ...editFormData, prodiNama: e.target.value, prodiQuery: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                          placeholder="Nama Program Studi"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kode MK</label>
                      <input
                        type="text"
                        value={editFormData.kodeMk || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, kodeMk: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#a80063]"
                        placeholder="26GZ11001"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Nama Mata Kuliah</label>
                      <input
                        type="text"
                        value={editFormData.namaMk || editFormData.mataKuliahNama || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, namaMk: e.target.value, mataKuliahNama: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                        placeholder="Nama Lengkap Mata Kuliah"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">SKS</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={editFormData.sks || 3}
                        onChange={(e) => setEditFormData({ ...editFormData, sks: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                      />
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block font-semibold text-slate-700">Pengajar / Dosen Utama</label>
                        {(!editFormData.dosenNama || editFormData.dosenNama === "-") && (
                          <button
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, dosenNama: "Dosen CDU", dosenQuery: "Dosen CDU" })}
                            className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 cursor-pointer transition-colors"
                          >
                            + Isi "Dosen CDU"
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editFormData.dosenNama && editFormData.dosenNama !== "-" ? editFormData.dosenNama : (editFormData.dosenQuery && editFormData.dosenQuery !== "-" ? editFormData.dosenQuery : "")}
                        onChange={(e) => setEditFormData({ ...editFormData, dosenNama: e.target.value, dosenQuery: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                        placeholder="Nama Dosen Utama & Gelar"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dosen Tandem (Opsional)</label>
                    <input
                      type="text"
                      value={editFormData.dosen2Nama && editFormData.dosen2Nama !== "-" ? editFormData.dosen2Nama : (editFormData.dosen2Query && editFormData.dosen2Query !== "-" ? editFormData.dosen2Query : "")}
                      onChange={(e) => setEditFormData({ ...editFormData, dosen2Nama: e.target.value, dosen2Query: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                      placeholder="Nama Dosen Tandem (kosongkan jika tidak ada)"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Hari Perkuliahan</label>
                      <select
                        value={editFormData.jadwalHari && editFormData.jadwalHari !== "-" ? editFormData.jadwalHari : "Senin"}
                        onChange={(e) => setEditFormData({ ...editFormData, jadwalHari: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#a80063]"
                      >
                        {HARI_LIST.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jam Perkuliahan</label>
                      <input
                        type="text"
                        value={editFormData.jadwalJam && editFormData.jadwalJam !== "-" ? editFormData.jadwalJam : ""}
                        onChange={(e) => setEditFormData({ ...editFormData, jadwalJam: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                        placeholder="08:00 - 09:40"
                      />
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-medium">Pilihan cepat:</span>
                        {["08:00 - 09:40", "10:00 - 11:40", "13:00 - 14:40", "15:30 - 17:10"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setEditFormData({ ...editFormData, jadwalJam: preset })}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 hover:bg-[#fdf2f8] hover:text-[#a80063] text-slate-600 border border-slate-200 cursor-pointer transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Mode Pembelajaran</label>
                      <select
                        value={editFormData.modePembelajaran || "DARING"}
                        onChange={(e) => setEditFormData({ ...editFormData, modePembelajaran: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#a80063]"
                      >
                        <option value="LURING">Offline (Tatap Muka)</option>
                        <option value="DARING">Online (Daring)</option>
                        <option value="BIMBINGAN">Bimbingan (Skripsi/Proyek)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ruangan Kelas</label>
                      <input
                        type="text"
                        value={editFormData.ruangan || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, ruangan: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                        placeholder="B2A, R.301"
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === "dosen" && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                    <input
                      type="text"
                      value={editFormData.nama || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">NIP (Nomor Induk Pegawai)</label>
                      <input
                        type="text"
                        value={editFormData.nip || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, nip: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#a80063]"
                        placeholder="022026001 (opsional)"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">NIDN</label>
                      <input
                        type="text"
                        value={editFormData.nidn || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, nidn: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#a80063]"
                        placeholder="0412345678 (opsional)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">NUPTK</label>
                      <input
                        type="text"
                        value={editFormData.nuptk || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, nuptk: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#a80063]"
                        placeholder="1234567890123456 (opsional)"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={editFormData.email || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                        placeholder="dosen@nusaputra.ac.id (opsional)"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kode / Nama Prodi</label>
                    <input
                      type="text"
                      value={editFormData.kodeProdi || editFormData.prodiNama || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, kodeProdi: e.target.value, prodiNama: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                    />
                  </div>
                </div>
              )}

              {type === "mata-kuliah" && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kode MK</label>
                      <input
                        type="text"
                        value={editFormData.kode || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, kode: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#a80063]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Nama Mata Kuliah</label>
                      <input
                        type="text"
                        value={editFormData.nama || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, nama: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">SKS</label>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={editFormData.sks || 3}
                        onChange={(e) => setEditFormData({ ...editFormData, sks: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kode / Nama Prodi</label>
                      <input
                        type="text"
                        value={editFormData.kodeProdi || editFormData.prodiNama || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, kodeProdi: e.target.value, prodiNama: e.target.value })}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#a80063]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRowIndex(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Check size={13} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

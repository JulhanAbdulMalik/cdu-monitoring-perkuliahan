"use client";
// src/app/(dashboard)/laporan/rapor-dosen/ImportTridharmaModal.tsx
// Modal Unggah Rekap Data Tridharma (Penelitian & PkM)
// Tampilan Standar CDU Portal Simple & Clean (Preview Interaktif Sebelum Simpan)
// Resmi Quality Assurance Unit (QAU) & CDU Universitas Nusa Putra

import React, { useState, useRef, useMemo } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RotateCcw,
  Download,
  Search,
  FlaskConical,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  previewTridharmaImportAction,
  saveTridharmaImportAction,
  PreviewTridharmaResult,
} from "@/actions/rapor";

interface ImportTridharmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: string;
  semesterLabel?: string;
  onSuccess?: () => void;
}

export default function ImportTridharmaModal({
  isOpen,
  onClose,
  semesterId,
  semesterLabel,
  onSuccess,
}: ImportTridharmaModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewTridharmaResult | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter baris preview berdasarkan pencarian
  const filteredItems = useMemo(() => {
    if (!previewData) return [];
    if (!searchFilter.trim()) return previewData.items;
    const q = searchFilter.toLowerCase().trim();
    return previewData.items.filter(
      (item) =>
        item.dosenNama.toLowerCase().includes(q) ||
        (item.nipNidn && item.nipNidn.toLowerCase().includes(q)) ||
        item.prodiNama.toLowerCase().includes(q)
    );
  }, [previewData, searchFilter]);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setErrorMsg(null);
    setPreviewData(null);
    setIsLoadingPreview(false);
    setIsSaving(false);
    setStatusText("");
    setSearchFilter("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      setErrorMsg("Format file harus berupa berkas Excel (.xlsx atau .xls).");
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
    setIsLoadingPreview(true);
    setStatusText("Menganalisis dan mencocokkan data dosen...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await previewTridharmaImportAction(formData, semesterId);
      if (!res.success || !res.data) {
        setErrorMsg(res.error || "Gagal memproses file Excel Tridharma.");
        setPreviewData(null);
      } else {
        setPreviewData(res.data);
      }
    } catch (err: any) {
      console.error("Error processFile:", err);
      setErrorMsg(err?.message || "Terjadi kesalahan saat memproses file Excel.");
      setPreviewData(null);
    } finally {
      setIsLoadingPreview(false);
      setStatusText("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Unduh Template Excel Rekap Tridharma
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "No": 1,
        "NIP / NIDN": "012018007",
        "Nama Dosen": "Ir. SOMANTRI, S.T, M.Kom",
        "Program Studi": "Teknik Informatika",
        "Jumlah Penelitian": 3,
        "Jumlah Pengabdian": 2,
      },
      {
        "No": 2,
        "NIP / NIDN": "0403048803",
        "Nama Dosen": "Dr. Samsul Pahmi, M.Pd.",
        "Program Studi": "Teknik Informatika",
        "Jumlah Penelitian": 2,
        "Jumlah Pengabdian": 3,
      },
      {
        "No": 3,
        "NIP / NIDN": "-",
        "Nama Dosen": "Contoh Dosen Tanpa NIP",
        "Program Studi": "Akuntansi",
        "Jumlah Penelitian": 1,
        "Jumlah Pengabdian": 0,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    ws["!cols"] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 34 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Rekap Tridharma");
    XLSX.writeFile(wb, "Template_Import_Tridharma.xlsx");
    toast.success("Template Excel berhasil diunduh.");
  };

  // Simpan data setelah preview disetujui
  const handleConfirmSave = async () => {
    if (!previewData || previewData.matchedCount === 0) {
      toast.error("Tidak ada data dosen yang cocok untuk disimpan.");
      return;
    }

    setIsSaving(true);
    setStatusText("Menyimpan dan mengalkulasi ulang nilai akhir...");

    try {
      const validItems = previewData.items
        .filter((item) => item.isMatched && item.dosenId)
        .map((item) => ({
          dosenId: item.dosenId!,
          jumlahPenelitian: item.penelitianBaru,
          jumlahPengabdian: item.pengabdianBaru,
        }));

      const res = await saveTridharmaImportAction({
        semesterId,
        items: validItems,
        fileName: file?.name || "rekap_tridharma.xlsx",
      });

      if (res.success) {
        toast.success(`Berhasil memperbarui data Tridharma untuk ${res.count} dosen.`);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.error || "Gagal menyimpan data Tridharma.");
      }
    } catch (err: any) {
      console.error("Error saveTridharma:", err);
      toast.error(err?.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setIsSaving(false);
      setStatusText("");
    }
  };

  const isBusy = isLoadingPreview || isSaving;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div
        className={`w-full bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[94vh] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          previewData ? "max-w-5xl lg:max-w-6xl xl:max-w-7xl" : "max-w-xl"
        }`}
      >
        {/* Tombol Tutup Silang */}
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30 transition-colors"
          title="Tutup (ESC)"
        >
          <X size={18} />
        </button>

        {/* Header Standar CDU Portal */}
        <div className="mb-4 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <FlaskConical size={16} className="text-[#a80063]" />
            <span>Import Tridharma (Penelitian & PkM)</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal">
            Rekapitulasi Luaran Tridharma Universitas Nusa Putra &bull; Semester {semesterLabel || "Aktif"} 
          </p>
        </div>

        {/* Pesan Kesalahan */}
        {errorMsg && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 shrink-0 animate-in fade-in">
            <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Gagal Memproses Berkas:</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-rose-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Body Konten */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
          {previewData ? (
            /* ── TAMPILAN PREVIEW TABULAR SEBELUM SIMPAN ───────────────────────── */
            <div className="space-y-3">
              {/* Baris Pencarian & Ringkasan Status Compact */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Kolom Search di Kiri */}
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama dosen, NIP/NIDN, atau prodi di preview..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-lg focus:outline-none focus:border-[#a80063] focus:bg-white transition-colors"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Ringkasan Status Compact di Kanan */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/80">
                    <Users size={12} className="text-slate-500" />
                    <span>Total: <strong className="font-bold text-slate-900">{previewData.totalRows}</strong> Dosen</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200/80">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Cocok: <strong className="font-bold text-emerald-900">{previewData.matchedCount}</strong></span>
                  </span>

                  {previewData.unmatchedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200/80">
                      <AlertCircle size={12} className="text-amber-600" />
                      <span>Belum Terdaftar: <strong className="font-bold text-amber-900">{previewData.unmatchedCount}</strong></span>
                    </span>
                  )}
                </div>
              </div>

              {/* Tabel Preview Baris */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden max-h-[60vh] lg:max-h-[64vh] overflow-y-auto bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Nama Dosen & Prodi</th>
                      <th className="py-2.5 px-3 text-center w-28">Penelitian</th>
                      <th className="py-2.5 px-3 text-center w-28">Pengabdian</th>
                      <th className="py-2.5 px-3 text-center w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {item.rowNumber}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900 block truncate">
                            {item.dosenNama}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.nipNidn ? `NIP/NIDN: ${item.nipNidn} • ` : ""}
                            {item.prodiNama}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.penelitianBaru}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                            Skor {item.skorPenelitianBaru.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.pengabdianBaru}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                            Skor {item.skorPengabdianBaru.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {item.isMatched ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={10} />
                              <span>Cocok</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <AlertCircle size={10} />
                              <span>Belum Ada</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewData.unmatchedCount > 0 && (
                <p className="text-[11px] text-amber-600 italic">
                  * Catatan: Terdapat {previewData.unmatchedCount} dosen yang belum terdaftar di Master Dosen dan akan dilewati secara otomatis saat simpan.
                </p>
              )}
            </div>
          ) : (
            /* ── TAMPILAN FORM UPLOAD DRAG & DROP ─────────────────────────────── */
            <div className="space-y-3">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  file
                    ? "border-[#a80063] bg-[#fdf2f8]/40"
                    : "border-slate-300 hover:border-[#a80063]/50 hover:bg-slate-50/60"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  className="hidden"
                />
                <div className="w-11 h-11 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  {isLoadingPreview ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <Upload size={22} />
                  )}
                </div>

                {isLoadingPreview ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      {statusText || "Menganalisis Berkas Excel..."}
                    </p>
                    <p className="text-[11px] text-slate-400">Harap tunggu beberapa saat</p>
                  </div>
                ) : file ? (
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">{file.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB &bull; Klik untuk mengganti berkas
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">
                      Pilih atau Seret Berkas Excel Rekap Tridharma ke Sini
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Format <strong>.xlsx</strong> atau <strong>.xls</strong> data luaran Tridharma
                    </p>
                  </div>
                )}
              </div>

              {/* Baris Informasi & Unduh Template Excel */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <FileSpreadsheet size={15} className="text-[#a80063] shrink-0" />
                  <span>Belum memiliki format berkas yang sesuai?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-[#a80063] hover:border-[#fbcfe8] text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                >
                  <Download size={12} />
                  <span>Unduh Template Tridharma</span>
                </button>
              </div>

              {/* Catatan Penjelas */}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Berkas Excel Tridharma akan memperbarui kolom <strong>Penelitian</strong> dan <strong>Pengabdian Masyarakat (PkM)</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions Standar CDU Portal */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4 shrink-0">
          {previewData ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                <RotateCcw size={12} />
                <span>Batal / Ganti Berkas</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isBusy || previewData.matchedCount === 0}
                className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>{statusText || "Menyimpan..."}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Simpan ke Database ({previewData.matchedCount} Dosen)</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


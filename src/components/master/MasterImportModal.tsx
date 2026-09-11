"use client";
// src/components/master/MasterImportModal.tsx
// Universal Master Data Excel Import Modal (Plus Jakarta Sans & #a80063 Theme)

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Download,
  UploadCloud,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { generateTemplate } from "@/lib/template-generator";
import { ImportPreviewResult } from "@/actions/master-import";

interface MasterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: "dosen" | "mata-kuliah" | "kelas" | "prodi" | "semester";
  parseAction: (formData: FormData) => Promise<{ success: boolean; data?: ImportPreviewResult; error?: string }>;
  commitAction: (rows: any[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  onSuccess: () => void;
}

export default function MasterImportModal({
  isOpen,
  onClose,
  title,
  type,
  parseAction,
  commitAction,
  onSuccess,
}: MasterImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

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
        toast.success(`Berhasil mengimport ${res.count} data baru!`);
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
    onClose();
  }

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#a80063]" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Unggah berkas spreadsheet (.xlsx, .xls, .csv) sesuai dengan format kurikulum baku.
          </p>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Download Template Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#fdf2f8] to-[#fce7f3] border border-[#fbcfe8] flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#a80063]">
                Belum punya format file Excel?
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Gunakan template standar kami dengan contoh kolom yang sudah sesuai
              </p>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#a80063] border border-[#fbcfe8] text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
            >
              <Download size={13} />
              <span>Download Template</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              file
                ? "border-emerald-300 bg-emerald-50/20"
                : "border-slate-200 hover:border-[#a80063]/40 hover:bg-slate-50/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />

            {parsing ? (
              <div className="flex flex-col items-center justify-center py-3">
                <Loader2 size={28} className="text-[#a80063] animate-spin mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Menganalisis & memvalidasi file...
                </p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <FileCheck size={20} />
                </div>
                <p className="text-xs font-bold text-slate-900">{file.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#fdf2f8] text-[#a80063] flex items-center justify-center mb-2">
                  <UploadCloud size={20} />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Tarik file Excel ke sini, atau klik untuk memilih
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Mendukung format .xlsx, .xls, .csv
                </p>
              </div>
            )}
          </div>

          {/* Preview Table If Parsed */}
          {previewResult && (
            <div className="space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <p className="font-bold text-slate-800">
                  Pratinjau Data ({previewResult.totalRows} Baris)
                </p>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ {previewResult.validRows} Valid
                  </span>
                  {previewResult.invalidRows > 0 && (
                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      ✗ {previewResult.invalidRows} Bermasalah
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto max-h-48 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2 px-2.5">Baris</th>
                      <th className="py-2 px-2.5">Data Kolom Utama</th>
                      <th className="py-2 px-2.5">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.previewList.map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? "hover:bg-slate-50/70" : "bg-rose-50/30"}
                      >
                        <td className="py-2 px-2.5 font-bold text-slate-500 text-[11px]">
                          #{row.rowIndex}
                        </td>
                        <td className="py-2 px-2.5 font-medium text-slate-800">
                          {type === "dosen" && (
                            <span>
                              <strong>{row.data.nama}</strong> ({row.data.nidn || "Tanpa NIDN"}) — Prodi: {row.data.kodeProdi}
                            </span>
                          )}
                          {type === "mata-kuliah" && (
                            <span>
                              <strong>[{row.data.kode}]</strong> {row.data.nama} ({row.data.sks} SKS) — {row.data.kodeProdi}
                            </span>
                          )}
                          {type === "kelas" && (
                            <div className="space-y-0.5">
                              <div>
                                <span className="font-bold text-[#a80063]">[{row.data.kodeKelas}]</span>{" "}
                                <span className="font-semibold text-slate-800">{row.data.mataKuliahNama || row.data.namaMk}</span>{" "}
                                <span className="text-[10px] text-slate-500 font-medium">({row.data.sks || 3} SKS)</span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                                <span>Prodi: <strong>{row.data.prodiNama || row.data.prodiQuery}</strong></span>
                                <span>•</span>
                                <span>Pengajar: <strong>{row.data.dosenNama || row.data.dosenQuery}</strong></span>
                                <span>•</span>
                                <span>{row.data.jadwalHari}, {row.data.jadwalJam}</span>
                                {row.data.ruangan && (
                                  <>
                                    <span>•</span>
                                    <span>Ruang: <strong className="text-slate-700">{row.data.ruangan}</strong></span>
                                  </>
                                )}
                                <span>•</span>
                                <span>({row.data.modePembelajaran === "BIMBINGAN" ? "Bimbingan" : row.data.modePembelajaran === "LURING" ? "Offline" : "Online"})</span>
                              </div>
                            </div>
                          )}
                          {type === "prodi" && (
                            <span>
                              <strong>[{row.data.kodeProdi}]</strong> {row.data.namaProdi} — {row.data.namaFakultas}
                            </span>
                          )}
                          {type === "semester" && (
                            <span>
                              <strong>{row.data.tahunAkademik}</strong> ({row.data.periode}) {row.data.aktif ? "★ Aktif" : ""}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-600">
                              ✓ Siap
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-600 truncate max-w-[200px]"
                              title={row.errors.join(", ")}
                            >
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={committing}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleCommit}
            disabled={committing || !previewResult || previewResult.validRows === 0}
            className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {committing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            <span>
              {previewResult
                ? `Import ${previewResult.validRows} Data Valid`
                : "Import Data"}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

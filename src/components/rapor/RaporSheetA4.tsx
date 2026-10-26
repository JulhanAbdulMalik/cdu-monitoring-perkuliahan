"use client";
// src/components/rapor/RaporSheetA4.tsx
// Lembar Evaluasi & Rapor Mutu Tridharma Dosen (Format Resmi A4 Universitas Nusa Putra)
// Mengikuti standar visual SK resmi: Font Rockwell/Slab Serif, Kop Logo Tengah, Single TTD Kepala QAU, & Footer Akreditasi Resmi

import React, { useState } from "react";
import { RaporDosenDetailData } from "@/actions/rapor";

interface RaporSheetA4Props {
  data: RaporDosenDetailData;
  printDate?: string;
}

export default function RaporSheetA4({
  data,
  printDate,
}: RaporSheetA4Props) {
  const { dosen, semester, rapor, monitoringStats, calculation } = data;

  const [logoError, setLogoError] = useState(false);
  const [footerError, setFooterError] = useState(false);

  const totalSks = monitoringStats.kelasList?.reduce((acc, k) => acc + (k.sks || 0), 0) || 0;

  const formattedDate =
    printDate ||
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

  const rekomendasiList = rapor?.rekomendasiPerbaikan || [];

  // Komentar Mahasiswa (K1 - K5)
  const komentarList = (rapor?.komentarMahasiswa || []).map((k: string) => {
    let text = k;
    if (text.includes("%") && /%[0-9a-fA-F]{2}/.test(text)) {
      try {
        text = decodeURIComponent(text);
      } catch {
        // fallback
      }
    }
    return text.replace(/^kritik\s*:\s*/i, "").replace(/^saran\s*:\s*/i, "").trim();
  });

  // Sentimen
  const sentimen = {
    positifPct: rapor?.responPositifPct ?? 70,
    netralPct: rapor?.responNetralPct ?? 20,
    negatifPct: rapor?.responNegatifPct ?? 10,
  };

  // Narasi Kesimpulan Evaluasi
  const narasiKesimpulan =
    rapor?.narasiKesimpulan ||
    `Berdasarkan evaluasi Tridharma pada semester ${semester.tahunAkademik} ${semester.periode}, Dosen ${dosen.nama} menunjukkan kinerja mengajar dan mutu akademik dengan predikat ${calculation.predikat?.label || "Cukup"}. Rekomendasi peningkatan difokuskan pada pengayaan media pembelajaran LMS serta kontinuitas penelitian dan pengabdian kepada masyarakat.`;

  return (
    <div className="a4-sheet relative bg-white text-black mx-auto px-[20mm] pt-[10mm] pb-[2mm] w-[210mm] max-w-[210mm] min-h-[297mm] shadow-lg print:shadow-none print:p-0 print:m-0 print:max-w-none print:w-full font-rockwell text-[8.5pt] leading-normal flex flex-col justify-between overflow-hidden">
      {/* ── WATERMARK RESMI (Tengah Halaman) ──────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.15] select-none z-0">
        {!logoError ? (
          <img
            src="/images/logo-nusa-putra.png"
            alt="Watermark Nusa Putra"
            className="w-32 h-32 object-contain"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="w-80 h-80 rounded-full border-8 border-slate-900 flex flex-col items-center justify-center text-slate-900">
            <span className="text-4xl font-semibold">NPU</span>
            <span className="text-xs font-semibold mt-1 uppercase">Universitas Nusa Putra</span>
          </div>
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* ── KOP SURAT RESMI UNIVERSITAS NUSA PUTRA (Tengah) ──────────────────── */}
        <div className="text-center pb-1 mb-2">
          {/* Logo Nusa Putra Tengah */}
          <div className="flex justify-center mb-1">
            {!logoError ? (
              <img
                src="/images/logo-nusa-putra.png"
                alt="Logo Universitas Nusa Putra"
                className="h-24 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-14 px-4 rounded-md bg-[#fdf2f8] border border-[#fbcfe8] text-[#a80063] flex flex-col items-center justify-center font-rockwell">
                <span className="text-xs font-semibold">NUSA PUTRA</span>
                <span className="text-[8.5px] font-semibold uppercase text-slate-600">UNIVERSITY</span>
              </div>
            )}
          </div>

          <h1 className="text-[10pt] font-semibold text-black uppercase">
            UNIVERSITAS NUSA PUTRA
          </h1>
        </div>

        {/* ── JUDUL DOKUMEN ────────────────────────────────────────────────────── */}
        <div className="text-center mb-2">
          <h2 className="text-[10pt] font-semibold text-black uppercase underline underline-offset-4 decoration-1">
            LEMBAR EVALUASI &amp; RAPOR MUTU TRIDHARMA DOSEN
          </h2>
          <p className="text-[8.5pt] text-black font-medium mt-0.5 uppercase">
            SEMESTER {semester.tahunAkademik} - {semester.periode.toUpperCase()}
          </p>
        </div>

        {/* ── IDENTITAS DOSEN (Format Resmi Bersih Tanpa Container) ──────────── */}
        <div className="mb-2 text-[8.5pt]">
          <table className="w-full text-[8.5pt]">
            <tbody>
              <tr>
                <td className="py-0.5 font-medium text-black w-[105px] whitespace-nowrap">Nama Dosen</td>
                <td className="py-0.5 text-center font-normal text-slate-700 w-3">:</td>
                <td className="py-0.5 font-semibold text-black pr-4">{dosen.nama}</td>
                <td className="py-0.5 font-medium text-black w-[110px] whitespace-nowrap">Program Studi</td>
                <td className="py-0.5 text-center font-normal text-slate-700 w-3">:</td>
                <td className="py-0.5 text-black">{dosen.prodi?.nama || "-"}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">NIP / NIDN</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 text-black font-mono pr-4">
                  {dosen.nip || "-"} / {dosen.nidn || "-"}
                </td>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Beban Mengajar</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 text-black">
                  <span className="font-medium">{monitoringStats.totalKelas} Kelas</span> ({totalSks} SKS)
                </td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Status Validasi</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 font-medium text-black pr-4">
                  {rapor?.statusRapor === "FINAL" ? "FINAL (Terverifikasi)" : "DRAFT (Dalam Peninjauan)"}
                </td>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Tanggal Terbit</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 text-black">{formattedDate}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── BAGIAN A: TABEL 5 INDIKATOR KINERJA TRIDHARMA ───────────────────── */}
        <div className="mb-2">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[8.5pt] font-semibold uppercase text-black">
              A. TABEL CAPAIAN RIIL &amp; NILAI TERSTANDAR (SKALA 1.00 – 5.00)
            </h3>
            <span className="text-[7.5pt] font-normal text-slate-700">Standar Mutu QAU</span>
          </div>
          <table className="w-full text-[8pt] border-collapse border border-black text-left">
            <thead>
              <tr className="bg-slate-50 text-black font-semibold border-b border-black text-center">
                <th className="py-0.5 px-1 border border-black w-8">No</th>
                <th className="py-0.5 px-2 border border-black text-left">Indikator Kinerja Penilaian</th>
                <th className="py-0.5 px-2 border border-black">Capaian Riil</th>
                <th className="py-0.5 px-1 border border-black w-14">Nilai</th>
                <th className="py-0.5 px-1 border border-black w-14">Bobot</th>
                <th className="py-0.5 px-1 border border-black w-14">Terbobot</th>
                <th className="py-0.5 px-2 border border-black w-32">Kategori Mutu</th>
              </tr>
            </thead>
            <tbody>
              {calculation.indikatorList?.map((ind, idx) => (
                <tr key={ind.id} className="border-b border-black">
                  <td className="py-0.5 px-1 text-center font-normal text-black border border-black">
                    {idx + 1}
                  </td>
                  <td className="py-0.5 px-2 border border-black font-normal text-black">
                    {ind.nama}
                  </td>
                  <td className="py-0.5 px-2 text-center border border-black font-normal text-black">
                    {ind.satuan}
                  </td>
                  <td className="py-0.5 px-1 text-center font-normal border border-black text-black">
                    {ind.skorStandar != null ? ind.skorStandar.toFixed(2) : "-"}
                  </td>
                  <td className="py-0.5 px-1 text-center font-normal border border-black text-black">
                    {ind.bobot}%
                  </td>
                  <td className="py-0.5 px-1 text-center font-normal border border-black text-black">
                    {ind.skorTerbobot != null ? ind.skorTerbobot.toFixed(2) : "-"}
                  </td>
                  <td className="py-0.5 px-2 text-center font-normal border border-black text-black">
                    {ind.keterangan}
                  </td>
                </tr>
              ))}

              {/* TOTAL AKUMULASI (Style Biasa Monochrome Tanpa Warna-Warni) */}
              <tr className="bg-slate-50 text-black font-semibold border-t-2 border-black">
                <td colSpan={3} className="py-1 px-2 text-right uppercase border border-black">
                  Nilai Akhir Evaluasi Tridharma (Skala 1.00 – 5.00) :
                </td>
                <td className="py-1 px-1 text-center border border-black text-black">-</td>
                <td className="py-1 px-1 text-center border border-black text-black">100%</td>
                <td className="py-1 px-1 text-center border border-black text-[8.5pt] font-semibold text-black">
                  {calculation.nilaiAkhir != null ? calculation.nilaiAkhir.toFixed(2) : "-"}
                </td>
                <td className="py-1 px-2 text-center border border-black">
                  <span className="font-semibold uppercase text-black">
                    {calculation.predikat?.label || "Belum Lengkap"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Catatan Kriteria Penskoran */}
          <p className="mt-0.5 text-[7.5pt] text-black leading-snug text-justify">
            <span className="font-semibold">Catatan Kriteria:</span> Sangat Baik (&ge; 4.58), Baik (4.12 – 4.57), Cukup (3.66 – 4.11), Kurang Baik (3.20 – 3.65). Khusus Penelitian &amp; Pengabdian: 0 = 3.20 | 1 = 3.88 | 2 = 4.35 | &ge; 3 = 5.00.
          </p>
        </div>

        {/* ── BAGIAN B: REKOMENDASI PERBAIKAN & MASUKAN MAHASISWA ──────────────── */}
        <div className="mb-2 text-[8.5pt]">
          <div className="flex items-baseline justify-between mb-0.5">
            <h3 className="text-[8.5pt] font-semibold uppercase text-black">
              B. REKOMENDASI PERBAIKAN &amp; MASUKAN MAHASISWA
            </h3>
            <span className="text-[7.5pt] font-normal text-slate-700">
              (Sentimen: Positif {sentimen.positifPct}% &bull; Netral {sentimen.netralPct}% &bull; Negatif {sentimen.negatifPct}%)
            </span>
          </div>

          {/* Poin-poin Berbaris ke Bawah (Tidak Menjadi 2 Bagian Kanan-Kiri) */}
          <div className="space-y-1 mt-1">
            {/* 1. Rekomendasi Area Perbaikan */}
            <div>
              <p className="font-semibold text-black text-[8.5pt] mb-0.5">
                1. Rekomendasi Area Perbaikan:
              </p>
              <ol className="space-y-0.5 text-[8pt] text-black pl-3">
                {rekomendasiList.length > 0 ? (
                  rekomendasiList.slice(0, 5).map((p: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="font-semibold shrink-0">P{idx + 1}.</span>
                      <p className="flex-1 text-justify">{p.replace(/^P\d+:\s*/, "")}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-600 italic">Pertahankan performa pengajaran yang sudah sangat baik.</li>
                )}
              </ol>
            </div>

            {/* 2. Masukan / Kritik Konstruktif Mahasiswa */}
            <div>
              <p className="font-semibold text-black text-[8.5pt] mb-0.5">
                2. Masukan / Kritik Konstruktif Mahasiswa:
              </p>
              <ol className="space-y-0.5 text-[8pt] text-black pl-3">
                {komentarList.length > 0 ? (
                  komentarList.slice(0, 5).map((k: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 leading-snug">
                      <span className="font-semibold shrink-0">K{idx + 1}.</span>
                      <p className="flex-1 italic text-justify">&ldquo;{k}&rdquo;</p>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-600 italic">Tidak ada masukan kritis tambahan dari mahasiswa.</li>
                )}
              </ol>
            </div>
          </div>
        </div>

        {/* ── BAGIAN C: KESIMPULAN EVALUASI ASESOR / QAU ──────────────────────── */}
        <div className="mb-2 text-[8.5pt]">
          <h3 className="text-[8.5pt] font-semibold uppercase text-black mb-0.5">
            C. KESIMPULAN EVALUASI ASESOR / QAU
          </h3>
          <p className="text-[8pt] text-black leading-relaxed italic text-justify pl-3 border-l-2 border-black">
            &ldquo;{narasiKesimpulan}&rdquo;
          </p>
        </div>

        {/* ── PENGESAHAN: TANDA TANGAN TUNGGAL KEPALA QAU (Sebelah Kanan) ──────── */}
        <div className="flex justify-end pt-1 mb-1">
          <div className="w-64 text-center text-[8.5pt]">
            <p className="text-[8pt] text-black font-normal mb-0.5">
              Sukabumi, {formattedDate}
            </p>
            <p className="font-semibold text-black leading-tight">
              Mengesahkan,<br />
              Kepala Quality Assurance Unit (QAU)
            </p>

            {/* Ruang TTD & Cap */}
            <div className="h-14 flex items-center justify-center">
              <span className="text-[7.5pt] text-slate-400 italic">
                ( Tanda Tangan &amp; Cap Digital )
              </span>
            </div>

            <div>
              <p className="font-semibold text-black underline">
                ( .................................................... )
              </p>
              <p className="text-[8pt] text-black font-mono mt-0.5">
                NIP / NIDN. .........................................
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER RESMI UNIVERSITAS NUSA PUTRA (Banner Resmi SK) ─────────────── */}
      <div className="relative z-10 pt-2 shrink-0">
        {!footerError ? (
          <div className="flex justify-center w-full">
            <img
              src="/images/footer-akreditasi.png"
              alt="Footer Resmi & Akreditasi Universitas Nusa Putra"
              className="w-full max-w-[185mm] h-auto object-contain max-h-24"
              onError={() => setFooterError(true)}
            />
          </div>
        ) : (
          <div className="text-center text-[8.5px] text-slate-600 space-y-0.5">
            <p className="font-semibold text-slate-700 uppercase text-[9px]">
              NUSA PUTRA BUILDING
            </p>
            <p className="text-[8px] leading-tight text-slate-500">
              Jl. Raya Cibatu Cisaat No.21, Cibolang Kaler, Kec. Cisaat, Kabupaten Sukabumi, Jawa Barat 43152 &bull; ☎ +62 266-210594 &bull; 📠 +62 266-237287
            </p>
            <div className="flex items-center justify-center gap-2.5 text-[8px] text-slate-500">
              <span>Nusa Putra University</span>
              <span>&bull;</span>
              <span>info@nusaputra.ac.id</span>
              <span>&bull;</span>
              <span>nusaputra.ac.id</span>
              <span>&bull;</span>
              <span>WA: 0857-5999-9213</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[8px] font-semibold text-slate-500 uppercase py-0.5">
              <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50">AQAS Germany</span>
              <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50">EQAR Europe</span>
              <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50">KAN Akreditasi</span>
              <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50">BAN-PT Terakreditasi</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const { dosen, semester, rapor, monitoringStats, calculation, config } = data;

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
    return text
      .replace(/^\[\d+\]\s*/, "") 
      .replace(/^\d+[\.\)]\s*/, "") 
      .replace(/^k\d+[\.\:\-]\s*/i, "") 
      .replace(/^kritik\s*:\s*/i, "")
      .replace(/^saran\s*:\s*/i, "")
      .trim();
  });

  // Sentimen
  const sentimen = {
    positifPct: rapor?.responPositifPct ?? 70,
    netralPct: rapor?.responNetralPct ?? 20,
    negatifPct: rapor?.responNegatifPct ?? 10,
  };

  // Narasi Kesimpulan Evaluasi
  const rawNarasi =
    rapor?.narasiKesimpulan ||
    `Berdasarkan evaluasi Tridharma pada semester ${semester.tahunAkademik} ${semester.periode}, Dosen ${dosen.nama} menunjukkan kinerja mengajar dan mutu akademik dengan predikat ${calculation.predikat?.label || "Cukup"}. Rekomendasi peningkatan difokuskan pada pengayaan media pembelajaran LMS serta kontinuitas penelitian dan pengabdian kepada masyarakat.`;

  const narasiKesimpulan = rawNarasi
    .replace(/pada Bagian C/gi, "pada Bagian B")
    .replace(/\bBagian C\b/g, "Bagian B");

  // Perhitungan total sesi mengajar dan target sesi semester
  const kelasCount = monitoringStats.totalKelas > 0 ? monitoringStats.totalKelas : ((rapor as any)?.totalKelasOverride || 0);
  const targetPerKelas = (data.config?.targetSesi && data.config.targetSesi > 0) ? data.config.targetSesi : 16;
  const totalTargetSesi = kelasCount > 0 ? kelasCount * targetPerKelas : 0;
  
  // Prioritaskan nilai kehadiran dari rapor (hasil edit manual), jika belum ada gunakan monitoring real-time
  const totalHadirSesi =
    rapor?.rerataSesiHadir != null && kelasCount > 0
      ? Math.round(rapor.rerataSesiHadir * kelasCount)
      : rapor?.persenKehadiran != null && totalTargetSesi > 0
      ? Math.round((rapor.persenKehadiran / 100) * totalTargetSesi)
      : monitoringStats.totalSesiHadirSemua;

  // Perhitungan total skor 3 pilar konten dan total max skor pilar untuk seluruh kelas reguler
  let totalSkorPilar = 0;
  let totalMaxPilar = 0;
  (monitoringStats.kelasList || []).forEach((k) => {
    if (k.modePembelajaran !== "BIMBINGAN") {
      totalSkorPilar += k.totalSkor3Pilar || 0;
      totalMaxPilar += k.maxSkor3Pilar || 28;
    }
  });
  // Fallback jika tidak ada kelas reguler tetapi ada kelas bimbingan
  if (totalMaxPilar === 0 && (monitoringStats.kelasList || []).length > 0) {
    (monitoringStats.kelasList || []).forEach((k) => {
      totalSkorPilar += k.totalSkor3Pilar || 0;
      totalMaxPilar += k.maxSkor3Pilar || 28;
    });
  }
  // Fallback untuk semester lampau tanpa kelasList riil
  if (totalMaxPilar === 0 && kelasCount > 0) {
    totalMaxPilar = kelasCount * 28;
  }

  // Prioritaskan nilai konten dari rapor (hasil edit manual) jika ada
  if (rapor?.persenKonten != null && totalMaxPilar > 0) {
    totalSkorPilar = Math.round((rapor.persenKonten / 100) * totalMaxPilar);
  }

  // Format Capaian (misal Kuesioner: '4.48', Kehadiran: '24 / 96 Sesi', Konten: '39 / 140 Poin', Penelitian/PkM: '3')
  const formatAngkaCapaian = (ind: (typeof calculation.indikatorList)[number]) => {
    if (ind.capaianRiil == null) return "-";
    if (ind.id === "kuesioner") {
      const val = Number(ind.capaianRiil);
      return isNaN(val) ? String(ind.capaianRiil) : val.toFixed(2);
    }
    if (ind.id === "kehadiran") {
      if (totalTargetSesi > 0) {
        return `${totalHadirSesi} / ${totalTargetSesi} Sesi`;
      }
      const val = Number(ind.capaianRiil);
      return isNaN(val) ? String(ind.capaianRiil) : val.toFixed(1);
    }
    if (ind.id === "konten") {
      if (totalMaxPilar > 0) {
        return `${totalSkorPilar} / ${totalMaxPilar} Poin`;
      }
      const val = Number(ind.capaianRiil);
      return isNaN(val) ? String(ind.capaianRiil) : `${val.toFixed(1)}%`;
    }
    return String(ind.capaianRiil);
  };

  return (
    <div className="a4-sheet relative bg-white text-black mx-auto px-[20mm] pt-[7mm] pb-[2mm] w-[210mm] max-w-[210mm] min-h-[297mm] h-[297mm] max-h-[297mm] shadow-lg print:shadow-none print:border-none print:m-0 font-rockwell text-[9pt] leading-normal flex flex-col justify-between overflow-hidden">
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
        <div className="text-center pb-0.5 mb-1.5">
          {/* Logo Nusa Putra Tengah */}
          <div className="flex justify-center mb-0.5">
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

          <h1 className="text-[10.5pt] font-semibold text-black uppercase">
            UNIVERSITAS NUSA PUTRA
          </h1>
        </div>

        {/* ── JUDUL DOKUMEN ────────────────────────────────────────────────────── */}
        <div className="text-center mb-1.5">
          <h2 className="text-[10.5pt] font-semibold text-black uppercase underline underline-offset-4 decoration-1">
            LEMBAR EVALUASI &amp; RAPOR MUTU TRIDHARMA DOSEN
          </h2>
          <p className="text-[9pt] text-black font-medium mt-0.5 uppercase">
            SEMESTER {semester.tahunAkademik} - {semester.periode.toUpperCase()}
          </p>
        </div>

        {/* ── IDENTITAS DOSEN (Format Resmi Bersih Tanpa Container) ──────────── */}
        <div className="mb-1.5 text-[9pt]">
          <table className="w-full text-[9pt]">
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
                <td className="py-0.5 text-black pr-4">
                  {dosen.nip || "-"} / {dosen.nidn || "-"}
                </td>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Beban Mengajar</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 text-black">
                  <span className="font-medium">{kelasCount} Kelas</span> ({totalSks > 0 ? totalSks : ((rapor as any)?.totalSksOverride || kelasCount * 2)} SKS)
                </td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Responden</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 font-medium text-black pr-4">
                  {rapor?.totalResponden ?? 0} Mahasiswa
                </td>
                <td className="py-0.5 font-medium text-black whitespace-nowrap">Tanggal Terbit</td>
                <td className="py-0.5 text-center font-normal text-slate-700">:</td>
                <td className="py-0.5 text-black">{formattedDate}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mb-1.5">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-[9pt] font-semibold uppercase text-black">
              A. REKAPITULASI PENILAIAN
            </h3>
          </div>
          <table className="w-full text-[8.5pt] border-collapse border border-black text-left">
            <thead>
              <tr className="bg-slate-50 text-black font-semibold border-b border-black text-center">
                <th className="py-1 px-1 border border-black w-8">No</th>
                <th className="py-1 px-2 border border-black text-left">Indikator Kinerja Penilaian</th>
                <th className="py-1 px-2 border border-black w-24">Capaian</th>
                <th className="py-1 px-1 border border-black w-28 text-center leading-tight">
                  Nilai Konversi<br />
                  {/* <span className="text-[7pt] font-normal block">(Skala 1.00 – 5.00)</span> */}
                </th>
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
                    {formatAngkaCapaian(ind)}
                  </td>
                  <td className="py-0.5 px-1 text-center font-normal border border-black text-black">
                    {ind.skorStandar != null ? ind.skorStandar.toFixed(2) : "-"}
                  </td>
                  <td className="py-0.5 px-1 text-center font-normal border border-black text-black">
                    {ind.skorTerbobot != null ? ind.skorTerbobot.toFixed(2) : "-"}
                  </td>
                  <td className="py-0.5 px-2 text-center font-normal border border-black text-black">
                    {ind.keterangan}
                  </td>
                </tr>
              ))}

              {/* TOTAL AKUMULASI (Garis border-t 1px halus selaras dengan border-b header) */}
              <tr className="bg-slate-50 text-black font-semibold border-t border-black">
                <td colSpan={3} className="py-1 px-2 text-center border border-black">
                  Nilai Akhir Evaluasi Tridharma
                </td>
                <td className="py-1 px-1 text-center border border-black text-black">-</td>
                <td className="py-1 px-1 text-center border border-black text-[9pt] font-semibold text-black">
                  {calculation.nilaiAkhir != null ? calculation.nilaiAkhir.toFixed(2) : "-"}
                </td>
                <td className="py-1 px-2 text-center border border-black">
                  <span className="font-semibold text-black">
                    {calculation.predikat?.label || "Belum Lengkap"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── BAGIAN B: REKOMENDASI PERBAIKAN & MASUKAN MAHASISWA ──────────────── */}
        <div className="mb-1.5 text-[9pt]">
          <h3 className="text-[9pt] font-semibold uppercase text-black mb-1">
            B. ASPEK PEMBELAJARAN
          </h3>

          {/* Poin-poin Berbaris ke Bawah (Tab satu kali ke kanan agar tidak sejajar dengan judul Poin B) */}
          <div className="ml-3 space-y-1">
            {/* 1. Rekomendasi Area Perbaikan */}
            <div>
              <p className="font-semibold text-black text-[9pt] mb-0.5">
                1. Rekomendasi Perbaikan:
              </p>
              <ol className="space-y-0.5 text-[8.5pt] text-black pl-3">
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
              <p className="font-semibold text-black text-[9pt] mb-0.5">
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
        <div className="mb-1.5 text-[9pt]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[9pt] font-semibold uppercase text-black">
              C. KESIMPULAN &amp; ANALISIS SENTIMEN MAHASISWA
            </h3>
            {/* Blok Sentimen: Positif (Hijau), Netral (Grey White), Negatif (Merah) */}
            <div className="flex items-center gap-1.5 text-[7.5pt]">
              <span className="font-medium text-slate-700">Sentimen:</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                Positif {sentimen.positifPct}%
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-medium">
                Netral {sentimen.netralPct}%
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-medium">
                Negatif {sentimen.negatifPct}%
              </span>
            </div>
          </div>

          {/* Isi Poin C: Ditab satu kali ke kanan (ml-3) agar posisi beda dengan Poin C */}
          <div className="ml-3 pl-2.5 border-l-2 border-black">
            <p className="text-[8.5pt] text-black leading-snug italic text-justify">
              &ldquo;{narasiKesimpulan}&rdquo;
            </p>
          </div>
        </div>

        {/* ── BAGIAN BAWAH: TABEL KRITERIA (KIRI) & PENGESAHAN (KANAN) ─ */}
        <div className="flex items-start justify-between gap-6 pt-3.5 mb-0.5">
          {/* KIRI: Tabel Catatan Kriteria */}
          <div className="w-[310px] shrink-0 text-[7.5pt]">
            <p className="font-semibold text-black uppercase mb-1">
              Catatan Kriteria:
            </p>
            <table className="w-full text-[7pt] border-collapse border border-black text-left">
              <thead>
                <tr className="bg-slate-50 text-black font-semibold border-b border-black text-center">
                  <th className="py-0.5 px-1.5 border border-black text-left">Predikat Mutu</th>
                  <th className="py-0.5 px-1 border border-black">Rentang Skor</th>
                  <th className="py-0.5 px-1.5 border border-black">Khusus Penelitian &amp; PkM</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-1.5 border border-black font-medium">Sangat Baik</td>
                  <td className="py-0.5 px-1 border border-black text-center">&ge; 4.58</td>
                  <td className="py-0.5 px-1.5 border border-black text-center">&ge; 3 Kegiatan = 5.00</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-1.5 border border-black font-medium">Baik</td>
                  <td className="py-0.5 px-1 border border-black text-center">4.12 – 4.57</td>
                  <td className="py-0.5 px-1.5 border border-black text-center">2 Kegiatan = 4.35</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-0.5 px-1.5 border border-black font-medium">Cukup</td>
                  <td className="py-0.5 px-1.5 border border-black text-center">3.66 – 4.11</td>
                  <td className="py-0.5 px-1.5 border border-black text-center">1 Kegiatan = 3.88</td>
                </tr>
                <tr>
                  <td className="py-0.5 px-1.5 border border-black font-medium">Kurang Baik</td>
                  <td className="py-0.5 px-1 border border-black text-center">3.20 – 3.65</td>
                  <td className="py-0.5 px-1.5 border border-black text-center">0 Kegiatan = 0.00</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* KANAN: Pengesahan Kepala QAU */}
          <div className="w-64 text-center text-[9pt]">
            <p className="text-[8.5pt] text-black font-normal mb-0.5">
              {config?.kotaTerbit || "Sukabumi"}, {formattedDate}
            </p>
            <p className="font-semibold text-black leading-tight">
              Mengetahui,<br />
              {config?.jabatanPejabat || "Kepala Quality Assurance Unit (QAU)"}
            </p>

            {/* Ruang TTD & Cap (Tampil gambar statis resmi jika TTD Digital diaktifkan, atau ruang kosong jika fisik) */}
            <div className="h-12 flex items-center justify-center relative">
              {config?.showTtdDigital ? (
                <img
                  src="/images/ttd-kepala-qau.png"
                  alt={`Tanda Tangan ${config?.namaPejabat || "Kepala QAU"}`}
                  className="max-h-20 w-auto object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>

            <div>
              <p className="font-semibold text-black underline leading-snug">
                {config?.namaPejabat || "Dr. Samsul Pahmi, M.Pd."}
              </p>
              <p className="text-[8.5pt] text-black leading-snug">
                NIDN. {config?.nidnPejabat || "0403048803"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER RESMI UNIVERSITAS NUSA PUTRA (Banner Resmi SK) ─────────────── */}
      <div className="relative z-10 pt-1 shrink-0">
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

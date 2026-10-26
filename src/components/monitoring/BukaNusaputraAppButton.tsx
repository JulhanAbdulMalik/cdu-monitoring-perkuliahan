// src/components/monitoring/BukaNusaputraAppButton.tsx
// Tombol "Buka di nusaputra.app": membuka halaman sesi kelas di LMS nusaputra.app (tab baru)
// untuk membandingkan langsung dengan data monitoring. Tidak menyimpan/mengubah apa pun.

import { ExternalLink } from "lucide-react";

/** Hanya URL https ke nusaputra.app yang boleh dibuka (cegah URL asing tersimpan di DB). */
const HOST_DIIZINKAN = ["nusaputra.app", "www.nusaputra.app"];

interface BukaNusaputraAppButtonProps {
  kodeKelas: string;
  externalUrl?: string | null;
}

function urlValid(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && HOST_DIIZINKAN.includes(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function BukaNusaputraAppButton({ kodeKelas, externalUrl }: BukaNusaputraAppButtonProps) {
  const kelas =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-all shadow-xs";
  const href = urlValid(externalUrl);

  if (!href) {
    return (
      <span
        className={`${kelas} opacity-50 cursor-not-allowed`}
        title={`Kelas [${kodeKelas}] belum terhubung ke nusaputra.app`}
        aria-disabled="true"
      >
        <ExternalLink size={13} />
        <span>Buka di nusaputra.app</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${kelas} hover:bg-indigo-100 cursor-pointer active:scale-95`}
      title={`Buka kelas [${kodeKelas}] di LMS nusaputra.app (tab baru, perlu login)`}
    >
      <ExternalLink size={13} />
      <span>Buka di nusaputra.app</span>
    </a>
  );
}

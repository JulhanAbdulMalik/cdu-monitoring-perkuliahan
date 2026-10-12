// src/components/monitoring/BukaEdlinkButton.tsx
// Tombol "Buka di Edlink": membuka halaman kelas di Edlink (tab baru) untuk
// membandingkan langsung dengan data monitoring. Tidak menyimpan/mengubah apa pun.

import { ExternalLink } from "lucide-react";

const EDLINK_KELAS_URL = "https://edlink.id/classes/";

interface BukaEdlinkButtonProps {
  kodeKelas: string;
  edlinkGroupId?: number | null;
}

export default function BukaEdlinkButton({ kodeKelas, edlinkGroupId }: BukaEdlinkButtonProps) {
  const kelas =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-all shadow-xs";

  // ID harus bilangan bulat positif; selain itu tombol nonaktif (juga mencegah URL aneh).
  if (!edlinkGroupId || !Number.isInteger(edlinkGroupId) || edlinkGroupId <= 0) {
    return (
      <span
        className={`${kelas} opacity-50 cursor-not-allowed`}
        title={`Kelas [${kodeKelas}] belum terhubung ke Edlink`}
        aria-disabled="true"
      >
        <ExternalLink size={13} />
        <span>Buka di Edlink</span>
      </span>
    );
  }

  return (
    <a
      href={`${EDLINK_KELAS_URL}${edlinkGroupId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${kelas} hover:bg-indigo-100 cursor-pointer active:scale-95`}
      title={`Buka kelas [${kodeKelas}] di Edlink (tab baru, perlu login Edlink)`}
    >
      <ExternalLink size={13} />
      <span>Buka di Edlink</span>
    </a>
  );
}

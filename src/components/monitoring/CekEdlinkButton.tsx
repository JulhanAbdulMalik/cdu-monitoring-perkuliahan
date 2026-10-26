"use client";
// src/components/monitoring/CekEdlinkButton.tsx
// Tombol "Cek dari Edlink" / "Cek nusaputra.app": minta worker menarik data sesi kelas ini dari
// sumber LMS-nya (Edlink atau LMS nusaputra.app),
// tunggu hasilnya, lalu kirim data sesi terbaru ke parent untuk memperbarui grid.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { mintaCekEdlink, getStatusCekEdlink, HasilCekEdlink } from "@/actions/edlink-cek";

export interface SesiEdlinkTerbaru {
  id: string;
  nomorSesi: number;
  tanggal: Date | string | null;
  kehadiran: string;
  lectureNote: boolean | null;
  slide: boolean | null;
  video: boolean | null;
  conference: boolean | null;
  tugas: boolean | null;
  kuis: boolean | null;
}

interface CekEdlinkButtonProps {
  kelasId: string;
  kodeKelas: string;
  terpetakan: boolean;
  edlinkSyncedAt?: Date | string | null;
  /** Sumber LMS kelas; menentukan label tombol & pesan. Default Edlink. */
  sumberLms?: "EDLINK" | "NUSAPUTRA_APP";
  /** Dikunci bila ada perubahan belum disimpan (hindari menimpa input staf di layar). */
  disabled?: boolean;
  onSelesai: (sesi: SesiEdlinkTerbaru[], syncedAt: Date | string | null) => void;
}

const INTERVAL_MS = 2500;
const BATAS_TUNGGU_MS = 3 * 60 * 1000;

const LABEL_FIELD: Record<string, string> = {
  lectureNote: "LN",
  slide: "Slide",
  video: "Video",
  conference: "Conference",
  tugas: "Tugas",
  kuis: "Kuis",
  kehadiran: "Kehadiran",
  tanggal: "Tanggal",
};

function formatWaktu(v?: Date | string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ringkasHasil(hasil: HasilCekEdlink | null, namaSumber: string): string {
  const n = hasil?.sesiDiperbarui ?? 0;
  if (n === 0) return `Data sudah sesuai ${namaSumber}, tidak ada perubahan.`;
  const perSesi = new Map<number, string[]>();
  for (const p of hasil?.perubahan ?? []) {
    if (p.ke !== true && p.field !== "kehadiran" && p.field !== "tanggal") continue;
    const arr = perSesi.get(p.nomorSesi) ?? [];
    arr.push(LABEL_FIELD[p.field] ?? p.field);
    perSesi.set(p.nomorSesi, arr);
  }
  const detail = [...perSesi.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, 6)
    .map(([no, f]) => `S${no}: ${f.join(", ")}`)
    .join(" • ");
  return `${n} sesi diperbarui${detail ? ` — ${detail}` : ""}`;
}

export default function CekEdlinkButton({
  kelasId,
  kodeKelas,
  terpetakan,
  edlinkSyncedAt,
  sumberLms = "EDLINK",
  disabled,
  onSelesai,
}: CekEdlinkButtonProps) {
  const namaSumber = sumberLms === "NUSAPUTRA_APP" ? "nusaputra.app" : "Edlink";
  const [berjalan, setBerjalan] = useState(false);
  // Waktu sinkron hasil cek lokal (per kelas); fallback ke nilai dari server.
  const [syncLokal, setSyncLokal] = useState<{ kelasId: string; at: Date | string | null } | null>(null);
  const syncedAt = syncLokal?.kelasId === kelasId ? syncLokal.at : edlinkSyncedAt;
  const aktif = useRef(true);

  useEffect(() => {
    aktif.current = true;
    return () => {
      aktif.current = false;
    };
  }, [kelasId]);

  async function handleCek() {
    if (berjalan) return;
    setBerjalan(true);
    const toastId = toast.loading(`Mengecek [${kodeKelas}] dari ${namaSumber}…`);
    try {
      const res = await mintaCekEdlink(kelasId);
      if (!res.success || !res.requestId) {
        toast.error(res.error || `Gagal memulai cek ${namaSumber}`, { id: toastId });
        return;
      }
      const mulai = Date.now();
      while (aktif.current && Date.now() - mulai < BATAS_TUNGGU_MS) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
        const st = await getStatusCekEdlink(res.requestId);
        if (!st.success || !st.data) {
          toast.error(st.error || "Gagal memuat status cek", { id: toastId });
          return;
        }
        if (st.data.status === "SELESAI") {
          if (st.data.sesi) onSelesai(st.data.sesi, st.data.edlinkSyncedAt);
          setSyncLokal({ kelasId, at: st.data.edlinkSyncedAt });
          const selisih = st.data.hasil?.selisihJadwal?.length ?? 0;
          toast.success(ringkasHasil(st.data.hasil, namaSumber), {
            id: toastId,
            description: selisih > 0 ? `${selisih} sesi: tanggal di ${namaSumber} berbeda dengan jadwal CDU.` : undefined,
            duration: 8000,
          });
          return;
        }
        if (st.data.status === "GAGAL") {
          toast.error(`Cek ${namaSumber} gagal: ${st.data.error || "tidak diketahui"}`, { id: toastId });
          return;
        }
      }
      if (aktif.current) {
        toast.warning(`Worker ${namaSumber} belum merespons. Coba lagi beberapa saat lagi.`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch {
      toast.error(`Terjadi kesalahan saat cek ${namaSumber}`, { id: toastId });
    } finally {
      if (aktif.current) setBerjalan(false);
    }
  }

  const waktu = formatWaktu(syncedAt);
  const title = !terpetakan
    ? `Kelas ini belum terhubung ke ${namaSumber}`
    : disabled
      ? `Simpan perubahan terlebih dahulu sebelum cek dari ${namaSumber}`
      : `Ambil data sesi [${kodeKelas}] langsung dari ${namaSumber}${waktu ? ` (terakhir: ${waktu})` : ""}`;

  return (
    <button
      type="button"
      onClick={handleCek}
      disabled={berjalan || !terpetakan || disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
      title={title}
    >
      {berjalan ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      <span>{berjalan ? "Mengecek…" : `Cek ${namaSumber}`}</span>
      {waktu && !berjalan && <span className="hidden xl:inline text-[10px] font-medium text-sky-600/80">· {waktu}</span>}
    </button>
  );
}

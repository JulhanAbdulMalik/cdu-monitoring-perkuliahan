"use client";
// src/components/notification/LoginAnnouncementModal.tsx
// Popup Pengumuman / Iklan Notifikasi saat Pengguna Login dengan opsi "Tidak ingin melihat lagi"

import { useState, useEffect } from "react";
import {
  X,
  Bell,
  AlertTriangle,
  Megaphone,
  Calendar,
  ExternalLink,
  User,
  Check,
} from "lucide-react";
import {
  UserNotificationItem,
  getUserNotifications,
  markNotificationAsRead,
} from "@/actions/notification";
import {
  formatPublisherName,
  formatPublisherRole,
  renderFormattedContent,
} from "./NotificationDetailModal";
import { formatExternalUrl } from "@/lib/utils";

const STORAGE_KEY = "cdu_dismissed_announcements";
const LOGIN_TRIGGER_KEY = "cdu_just_logged_in";

export default function LoginAnnouncementModal() {
  const [activeQueue, setActiveQueue] = useState<UserNotificationItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAnnouncements() {
      // Pastikan modal HANYA muncul saat sesi login baru saja berhasil
      // Jika user sedang berpindah halaman biasa atau melakukan refresh F5, JANGAN munculkan!
      let justLoggedIn = false;
      try {
        justLoggedIn = sessionStorage.getItem(LOGIN_TRIGGER_KEY) === "true";
      } catch {
        justLoggedIn = false;
      }

      if (!justLoggedIn) return;

      // Hapus flag segera agar refresh berikutnya atau navigasi ke halaman lain tidak lagi memunculkan modal
      try {
        sessionStorage.removeItem(LOGIN_TRIGGER_KEY);
      } catch {}

      try {
        const res = await getUserNotifications();
        if (!isMounted || !res.success || !res.data) return;

        // Ambil ID notifikasi yang sudah ditandai "Tidak ingin melihat lagi" oleh pengguna
        let dismissedIds: string[] = [];
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) dismissedIds = JSON.parse(raw);
        } catch {
          dismissedIds = [];
        }

        // Filter notifikasi yang ditandai popupLogin atau urgensi BAHAYA dan belum di-dismiss
        const popups = res.data.items.filter(
          (item) =>
            (item.isPopupLogin || item.urgensi === "BAHAYA") &&
            !dismissedIds.includes(item.id)
        );

        if (popups.length > 0) {
          setActiveQueue(popups);
          setCurrentIndex(0);
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Error loading popup announcements:", err);
      }
    }

    // Delay sedikit agar halaman dashboard selesai render awal secara mulus
    const timer = setTimeout(() => {
      checkAnnouncements();
    }, 700);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!isOpen || activeQueue.length === 0) return null;

  const currentItem = activeQueue[currentIndex];
  if (!currentItem) return null;

  const isBahaya = currentItem.urgensi === "BAHAYA";
  const isPeringatan = currentItem.urgensi === "PERINGATAN";

  const dateFormatted = new Date(currentItem.createdAt).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleDismiss = async () => {
    // Jika centang "Tidak ingin melihat lagi", simpan ID ke localStorage
    if (dontShowAgain) {
      try {
        let dismissedIds: string[] = [];
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) dismissedIds = JSON.parse(raw);
        if (!dismissedIds.includes(currentItem.id)) {
          dismissedIds.push(currentItem.id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissedIds));
        }
      } catch (e) {
        console.error("Error saving dismissed announcement:", e);
      }
    }

    // Tandai sudah dibaca di server
    try {
      await markNotificationAsRead(currentItem.id);
    } catch (e) {
      console.error("Error mark notification read:", e);
    }

    // Jika masih ada notifikasi popup lain dalam antrian, tampilkan berikutnya
    if (currentIndex < activeQueue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setDontShowAgain(false);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 sm:p-6 animate-fade-in"
    >
      <div className="w-full max-w-2xl sm:max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Banner Header Pop-up Iklan/Pengumuman */}
        <div className="p-6 sm:p-7 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                <Megaphone size={13} className="text-[#a80063]" />
                <span>Notifikasi</span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  isBahaya
                    ? "bg-rose-100 text-rose-800 border-rose-200"
                    : isPeringatan
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                }`}
              >
                {isBahaya ? (
                  <>
                    <AlertTriangle size={12} className="text-rose-600" />
                    <span>Urgent / Mendesak</span>
                  </>
                ) : isPeringatan ? (
                  <>
                    <AlertTriangle size={12} className="text-amber-600" />
                    <span>Peringatan</span>
                  </>
                ) : (
                  <>
                    <Bell size={12} className="text-[#a80063]" />
                    <span>Info Resmi</span>
                  </>
                )}
              </span>

              {activeQueue.length > 1 && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                  {currentIndex + 1} dari {activeQueue.length}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {currentItem.judul}
          </h3>

          {/* Info Penerbit & Waktu Inline */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-500 mt-2.5 pt-2 border-t border-slate-100/80">
            <div className="flex items-center gap-1.5 font-medium">
              <User size={13} className="text-slate-400 shrink-0" />
              <span>
                Penerbit:{" "}
                <strong className="text-slate-800 font-semibold">
                  {formatPublisherName(currentItem.dibuatOleh?.name, currentItem.dibuatOleh?.role)}
                </strong>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                {formatPublisherRole(currentItem.dibuatOleh?.role)}
              </span>
            </div>

            <span className="text-slate-300 hidden sm:inline">•</span>

            <div className="flex items-center gap-1 text-slate-500">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span>{dateFormatted}</span>
            </div>
          </div>
        </div>

        {/* Konten Lengkap Notifikasi - Clean, Open Layout */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-3.5 custom-scrollbar flex-1 select-text">
          <div className="space-y-1.5 text-slate-700 leading-relaxed font-normal">
            {renderFormattedContent(currentItem.pesan)}
          </div>

          {Boolean(currentItem.tautanUrl && formatExternalUrl(currentItem.tautanUrl)) && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  Tautan Lampiran
                </p>
                <p className="text-[11px] text-[#a80063] font-medium truncate mt-0.5">
                  {formatExternalUrl(currentItem.tautanUrl)}
                </p>
              </div>

              <a
                href={formatExternalUrl(currentItem.tautanUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#a80063] hover:bg-[#8f0054] shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <span>Buka Tautan</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>

        {/* Footer dengan Checkbox "Tidak ingin melihat lagi" & Tombol Aksi */}
        <div className="p-4 px-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              id="dontShowAgainCheckbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#a80063] focus:ring-[#a80063]/20 cursor-pointer accent-[#a80063]"
            />
            <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
              Tidak ingin melihat lagi
            </span>
          </label>

          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#a80063] hover:bg-[#8f0054] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Check size={13} />
            <span>Saya Mengerti</span>
          </button>
        </div>
      </div>
    </div>
  );
}

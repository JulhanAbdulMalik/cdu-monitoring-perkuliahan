"use client";
// src/components/notification/NotificationDetailModal.tsx
// Modal Detail Notifikasi Resmi CDU - Informatif, Bersih, dan Lengkap

import {
  X,
  Bell,
  AlertTriangle,
  Calendar,
  ExternalLink,
  User,
  Users,
  Megaphone,
} from "lucide-react";

export interface DetailNotificationData {
  id: string;
  judul: string;
  pesan: string;
  urgensi: "PENTING" | "PERINGATAN" | "BAHAYA";
  targetTipe?: string;
  targetProdiId?: string | null;
  targetKelasKode?: string | null;
  isPopupLogin?: boolean;
  tautanUrl?: string | null;
  createdAt: Date | string;
  dibuatOleh?: {
    name?: string;
    role?: string;
  };
}

interface NotificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: DetailNotificationData | null;
}

export function formatPublisherRole(role?: string) {
  if (!role) return "Pengelola CDU";
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Admin CDU";
  if (role === "DOSEN") return "Dosen";
  return role.replace(/_/g, " ");
}

export function formatPublisherName(name?: string, role?: string) {
  if (!name || name === "SUPER_ADMIN" || name === "ADMIN") {
    return role === "SUPER_ADMIN" ? "Super Admin CDU" : "Admin CDU";
  }
  return name;
}

export default function NotificationDetailModal({
  isOpen,
  onClose,
  notification,
}: NotificationDetailModalProps) {
  if (!isOpen || !notification) return null;

  const isBahaya = notification.urgensi === "BAHAYA";
  const isPeringatan = notification.urgensi === "PERINGATAN";

  const dateFormatted = new Date(notification.createdAt).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="space-y-2">
            {/* Badges Urgensi & Info */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold border ${
                  isBahaya
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : isPeringatan
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                }`}
              >
                {isBahaya ? (
                  <>
                    <AlertTriangle size={12} className="text-rose-600 shrink-0" />
                    <span>Urgent / Mendesak</span>
                  </>
                ) : isPeringatan ? (
                  <>
                    <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                    <span>Peringatan Resmi</span>
                  </>
                ) : (
                  <>
                    <Bell size={12} className="text-[#a80063] shrink-0" />
                    <span>Info Resmi CDU</span>
                  </>
                )}
              </span>

              {notification.isPopupLogin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  <Megaphone size={11} className="text-purple-600" />
                  <span>Pop-up Login</span>
                </span>
              )}
            </div>

            {/* Judul Notifikasi */}
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug pt-0.5">
              {notification.judul}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info Meta Banner */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <User size={13} className="text-slate-400" />
            <span>Penerbit:</span>
            <strong className="text-slate-800 font-semibold">
              {formatPublisherName(notification.dibuatOleh?.name, notification.dibuatOleh?.role)}
            </strong>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 font-medium">
              {formatPublisherRole(notification.dibuatOleh?.role)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10.5px] text-slate-400">
            <Calendar size={12} />
            <span>{dateFormatted}</span>
          </div>
        </div>

        {/* Konten Lengkap Pesan Notifikasi */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap select-text">
            {notification.pesan}
          </div>

          {/* Tautan URL Terkait jika ada */}
          {notification.tautanUrl && (
            <div className="p-3 rounded-xl bg-[#fdf2f8]/70 border border-[#fbcfe8] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#a80063]">
                  Tautan Lampiran / Halaman Terkait
                </p>
                <p className="text-[10.5px] text-slate-500 truncate mt-0.5">
                  {notification.tautanUrl}
                </p>
              </div>

              <a
                href={notification.tautanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#a80063] hover:bg-[#8f0054] shadow-2xs transition-all shrink-0 cursor-pointer"
              >
                <span>Buka Tautan</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

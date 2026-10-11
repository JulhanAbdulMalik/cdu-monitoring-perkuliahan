"use client";
// src/components/notification/NotificationDetailModal.tsx
// Modal Detail Notifikasi Resmi CDU - Modern, Simple, dan Lebih Lebar

import React from "react";
import {
  X,
  Bell,
  AlertTriangle,
  Calendar,
  ExternalLink,
  User,
  Megaphone,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatExternalUrl } from "@/lib/utils";

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
  isSelesai?: boolean;
  kadaluarsaPada?: Date | string | null;
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

/**
 * Lightweight & safe Markdown parser for headings (#, ##), bold (**text**), bullet points (-), and clean spacing
 */
export function renderFormattedContent(content: string) {
  if (!content) return null;

  const parseInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\*\*(.*?)\*\*/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`gap-${idx}`} className="h-2" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="text-xs sm:text-sm font-bold text-slate-900 mt-2.5">
          {parseInline(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={idx} className="text-sm sm:text-base font-extrabold text-slate-900 mt-3 pt-1">
          {parseInline(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={idx} className="text-base sm:text-lg font-black text-slate-900 mt-3 pb-1 border-b border-slate-100">
          {parseInline(trimmed.slice(2))}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 ml-2">
          <span className="text-[#a80063] font-bold text-xs mt-1 shrink-0">•</span>
          <span className="leading-relaxed">{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={idx} className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
          {parseInline(trimmed)}
        </p>
      );
    }
  });

  return elements;
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
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 sm:p-6 animate-fade-in"
    >
      <div className="w-full max-w-2xl sm:max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up">
        {/* Header Modal - Modern, Clean & Spacious */}
        <div className="p-6 sm:p-7 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            {/* Badges Urgensi */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isBahaya
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : isPeringatan
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                }`}
              >
                {isBahaya ? (
                  <>
                    <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                    <span>Urgent / Mendesak</span>
                  </>
                ) : isPeringatan ? (
                  <>
                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    <span>Peringatan Resmi</span>
                  </>
                ) : (
                  <>
                    <Bell size={13} className="text-[#a80063] shrink-0" />
                    <span>Info Resmi CDU</span>
                  </>
                )}
              </span>

              {notification.isPopupLogin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  <Megaphone size={12} className="text-purple-600" />
                  <span>Pop-up Login</span>
                </span>
              )}

              {notification.isSelesai && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  <span>Selesai / Nonaktif</span>
                </span>
              )}
            </div>

            {/* Tombol Tutup */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Tutup (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Judul Notifikasi */}
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {notification.judul}
          </h3>

          {/* Info Meta Inline - Bersih, Simple & Minimalis */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-500 mt-2.5 pt-2 border-t border-slate-100/80">
            <div className="flex items-center gap-1.5 font-medium">
              <User size={13} className="text-slate-400 shrink-0" />
              <span>
                Penerbit:{" "}
                <strong className="text-slate-800 font-semibold">
                  {formatPublisherName(notification.dibuatOleh?.name, notification.dibuatOleh?.role)}
                </strong>
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                {formatPublisherRole(notification.dibuatOleh?.role)}
              </span>
            </div>

            <span className="text-slate-300 hidden sm:inline">•</span>

            <div className="flex items-center gap-1 text-slate-500">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span>{dateFormatted}</span>
            </div>

            {notification.kadaluarsaPada && (
              <>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div className="flex items-center gap-1 text-amber-700 font-medium">
                  <Clock size={13} className="text-amber-500 shrink-0" />
                  <span>
                    Batas Tayang:{" "}
                    {new Date(notification.kadaluarsaPada).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Konten Lengkap Pesan Notifikasi - Tampilan Terbuka, Modern & Rapi */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-3.5 custom-scrollbar flex-1 select-text">
          <div className="space-y-1.5 text-slate-700 leading-relaxed font-normal">
            {renderFormattedContent(notification.pesan)}
          </div>

          {/* Tautan URL Terkait jika ada */}
          {Boolean(notification.tautanUrl && formatExternalUrl(notification.tautanUrl)) && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  Tautan Lampiran
                </p>
                <p className="text-[11px] text-[#a80063] font-medium truncate mt-0.5">
                  {formatExternalUrl(notification.tautanUrl)}
                </p>
              </div>

              <a
                href={formatExternalUrl(notification.tautanUrl)}
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

        {/* Footer Actions - Minimalis & Rapi */}
        <div className="p-4 px-6 sm:px-7 border-t border-slate-100 flex items-center justify-end bg-slate-50/40">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-all cursor-pointer shadow-2xs hover:border-slate-300"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

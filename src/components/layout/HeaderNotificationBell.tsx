"use client";
// src/components/layout/HeaderNotificationBell.tsx
// Komponen Popover Lonceng Notifikasi Resmi CDU dengan Data Riil & Real-time Sync

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Megaphone,
  AlertTriangle,
  CheckCheck,
  ChevronRight,
} from "lucide-react";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  UserNotificationItem,
} from "@/actions/notification";

interface HeaderNotificationBellProps {
  isAdminOrSuperAdmin: boolean;
}

function formatRelativeTime(dateInput: Date | string): string {
  const d = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return "Baru saja";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  if (diffSec < 86400 * 2) return "Kemarin";
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} hari lalu`;

  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function HeaderNotificationBell({
  isAdminOrSuperAdmin,
}: HeaderNotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getUserNotifications();
      if (res.success && res.data) {
        setItems(res.data.items);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // non-blocking
    }
  }, []);

  // Fetch pertama saat mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time Sync antar tab / jendela
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("cdu_monitoring_sync");
    channel.onmessage = (event) => {
      if (
        event.data?.type === "NOTIFICATION_CREATED" ||
        event.data?.type === "NOTIFICATION_DELETED" ||
        event.data?.type === "NOTIFICATION_READ"
      ) {
        fetchNotifications();
      }
    };

    return () => {
      channel.close();
    };
  }, [fetchNotifications]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifications();
    }
  };

  const handleItemClick = async (notif: UserNotificationItem) => {
    if (!notif.isRead) {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationAsRead(notif.id);

      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("cdu_monitoring_sync");
        channel.postMessage({ type: "NOTIFICATION_READ" });
        channel.close();
      }
    }

    if (notif.tautanUrl) {
      setIsOpen(false);
      if (notif.tautanUrl.startsWith("http")) {
        window.open(notif.tautanUrl, "_blank", "noopener,noreferrer");
      } else {
        router.push(notif.tautanUrl);
      }
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic update
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsAsRead();

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cdu_monitoring_sync");
      channel.postMessage({ type: "NOTIFICATION_READ" });
      channel.close();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng Bell */}
      <button
        onClick={handleToggle}
        className={`w-8 h-8 rounded-lg border transition-all flex items-center justify-center relative cursor-pointer ${
          isOpen
            ? "border-[#fbcfe8] bg-[#fdf2f8] text-[#a80063]"
            : unreadCount > 0
            ? "border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70"
            : "border-slate-200/70 bg-slate-50 hover:bg-[#fdf2f8] hover:border-[#fbcfe8] hover:text-[#a80063] text-slate-500"
        }`}
        title={unreadCount > 0 ? `${unreadCount} Notifikasi Resmi Belum Dibaca` : "Notifikasi Resmi"}
      >
        <Bell size={15} />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Notifikasi */}
      {isOpen && (
        <div className="absolute top-10 right-0 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-fade-in">
          {/* Header Popover */}
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">
              Notifikasi Resmi CDU
            </h4>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#a80063] hover:text-[#8f0054] hover:underline cursor-pointer"
                title="Tandai semua sudah dibaca"
              >
                <CheckCheck size={12} />
                <span>Tandai Semua Dibaca</span>
              </button>
            )}
          </div>

          {/* List Notifikasi */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {items.length === 0 ? (
              <div className="py-10 text-center px-4 space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell size={18} />
                </div>
                <p className="font-bold text-xs text-slate-700">Tidak ada notifikasi aktif</p>
              </div>
            ) : (
              items.map((item) => {
                const isPengumuman = item.tipe === "PENGUMUMAN";
                const isBahaya = item.urgensi === "BAHAYA";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3.5 transition-all cursor-pointer relative group ${
                      item.isRead
                        ? "bg-white hover:bg-slate-50/80"
                        : "bg-[#fdf2f8]/40 hover:bg-[#fdf2f8]/70"
                    }`}
                  >
                    {/* Unread Indicator Bar */}
                    {!item.isRead && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#a80063] rounded-r-full" />
                    )}

                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div
                        className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border mt-0.5 ${
                          isPengumuman
                            ? "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                            : isBahaya
                            ? "bg-rose-50 text-rose-600 border-rose-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {isPengumuman ? (
                          <Megaphone size={13} />
                        ) : (
                          <AlertTriangle size={13} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span
                            className={`text-[9.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                              isPengumuman
                                ? "bg-[#fdf2f8] text-[#a80063]"
                                : isBahaya
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {isPengumuman ? "Pengumuman Resmi" : "Peringatan CDU"}
                          </span>

                          <span className="text-[9.5px] text-slate-400 font-medium shrink-0">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <h5
                          className={`text-xs leading-snug line-clamp-2 ${
                            item.isRead
                              ? "font-semibold text-slate-800"
                              : "font-extrabold text-slate-900"
                          }`}
                        >
                          {item.judul}
                        </h5>

                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                          {item.pesan}
                        </p>

                        {/* Optional Meta Tags */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {item.targetKelasKode && (
                            <span className="text-[9px] font-bold text-[#a80063] bg-[#fdf2f8] px-1.5 py-0.2 rounded border border-[#fbcfe8]">
                              Kelas: {item.targetKelasKode}
                            </span>
                          )}

                          {item.tautanUrl && (
                            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-[#a80063] group-hover:underline">
                              <span>Lihat Detail</span>
                              <ChevronRight size={10} />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

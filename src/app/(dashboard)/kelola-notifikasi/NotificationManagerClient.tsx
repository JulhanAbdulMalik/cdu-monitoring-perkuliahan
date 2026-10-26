"use client";
// src/app/(dashboard)/kelola-notifikasi/NotificationManagerClient.tsx
// UI Client untuk Pengelolaan Pengumuman & Peringatan Resmi CDU

import { useState, useTransition, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  Megaphone,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  Search,
  Users,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldAlert,
  Eye,
  Loader2,
  Calendar,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Send,
  RotateCcw,
  Clock,
} from "lucide-react";
import {
  ManagementNotificationItem,
  CreateNotificationInput,
  NotificationType,
  NotificationTarget,
  NotificationUrgency,
  createNotification,
  updateNotification,
  deleteNotification,
  toggleNotificationStatus,
} from "@/actions/notification";
import SearchableSelect from "@/components/common/SearchableSelect";
import TablePagination from "@/components/common/TablePagination";
import NotificationDetailModal, {
  formatPublisherName,
  formatPublisherRole,
} from "@/components/notification/NotificationDetailModal";
import { formatExternalUrl } from "@/lib/utils";

interface NotificationManagerClientProps {
  initialNotifications: ManagementNotificationItem[];
  targetOptions: {
    dosenUsers: Array<{
      id: string;
      name: string;
      email: string;
      prodis: Array<{ id: string; nama: string; kode: string }>;
    }>;
    prodis: Array<{ id: string; nama: string; kode: string }>;
    activeClasses: Array<{
      id: string;
      kodeKelas: string;
      mataKuliah: { nama: string };
      dosen: { nama: string };
    }>;
  };
  currentUserRole: string;
}

export default function NotificationManagerClient({
  initialNotifications,
  targetOptions,
  currentUserRole,
}: NotificationManagerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [notifications, setNotifications] = useState<ManagementNotificationItem[]>(initialNotifications);

  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterUrgensi, setFilterUrgensi] = useState<"ALL" | NotificationUrgency>("ALL");
  const [filterTargetTipe, setFilterTargetTipe] = useState<"ALL" | NotificationTarget>("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "AKTIF" | "SELESAI">("ALL");

  // Pagination State Standar CDU Portal
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal State (Create & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ManagementNotificationItem | null>(null);
  const [formTargetTipe, setFormTargetTipe] = useState<NotificationTarget>("SEMUA");
  const [formTargetProdiId, setFormTargetProdiId] = useState<string>("");
  const [formJudul, setFormJudul] = useState("");
  const [formPesan, setFormPesan] = useState("");
  const [formUrgensi, setFormUrgensi] = useState<NotificationUrgency>("PENTING");
  const [formTautanUrl, setFormTautanUrl] = useState("");
  const [formIsPopupLogin, setFormIsPopupLogin] = useState(false);
  const [formKadaluarsaPada, setFormKadaluarsaPada] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal State
  const [selectedDetailItem, setSelectedDetailItem] = useState<ManagementNotificationItem | null>(null);

  // Delete Confirm State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Map Nama Prodi untuk Lookup Cepat
  const prodiMap = useMemo(() => {
    const map = new Map<string, string>();
    targetOptions.prodis?.forEach((p) => {
      map.set(p.id, `${p.nama} (${p.kode})`);
    });
    return map;
  }, [targetOptions.prodis]);

  // Filtered Notifications
  const filteredList = useMemo(() => {
    return notifications.filter((item) => {
      if (filterStatus === "AKTIF" && item.isSelesai) return false;
      if (filterStatus === "SELESAI" && !item.isSelesai) return false;
      if (filterUrgensi !== "ALL" && item.urgensi !== filterUrgensi) return false;
      if (filterTargetTipe !== "ALL" && item.targetTipe !== filterTargetTipe) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchJudul = item.judul.toLowerCase().includes(q);
        const matchPesan = item.pesan.toLowerCase().includes(q);
        const matchUser = item.targetUser?.name?.toLowerCase().includes(q) || false;
        const matchKelas = item.targetKelasKode?.toLowerCase().includes(q) || false;
        const matchProdi = (item.targetProdiId && prodiMap.get(item.targetProdiId)?.toLowerCase().includes(q)) || false;
        return matchJudul || matchPesan || matchUser || matchKelas || matchProdi;
      }
      return true;
    });
  }, [notifications, filterStatus, filterUrgensi, filterTargetTipe, searchQuery, prodiMap]);

  // Reset ke halaman 1 saat pencarian atau filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterUrgensi, filterTargetTipe]);

  // Data terpaginasi untuk tabel
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  const totalSelesai = notifications.filter((n) => n.isSelesai).length;
  const totalAktif = notifications.filter((n) => !n.isSelesai).length;
  const totalInfoResmi = notifications.filter((n) => !n.isSelesai && n.urgensi === "PENTING").length;
  const totalPeringatan = notifications.filter((n) => !n.isSelesai && n.urgensi === "PERINGATAN").length;
  const totalBahaya = notifications.filter((n) => !n.isSelesai && n.urgensi === "BAHAYA").length;

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTargetTipe("SEMUA");
    setFormUrgensi("PENTING");
    setFormTargetProdiId("");
    setFormJudul("");
    setFormPesan("");
    setFormTautanUrl("");
    setFormIsPopupLogin(false);
    setFormKadaluarsaPada("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ManagementNotificationItem) => {
    setEditingItem(item);
    setFormJudul(item.judul);
    setFormPesan(item.pesan);
    setFormUrgensi(item.urgensi);
    setFormTargetTipe(item.targetTipe);
    setFormTargetProdiId(item.targetProdiId || "");
    setFormTautanUrl(item.tautanUrl || "");
    setFormIsPopupLogin(Boolean(item.isPopupLogin || item.targetKelasKode === "POPUP_LOGIN"));
    if (item.kadaluarsaPada) {
      const d = new Date(item.kadaluarsaPada);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISODate = new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
      setFormKadaluarsaPada(localISODate);
    } else {
      setFormKadaluarsaPada("");
    }
    setFormError("");
    setIsModalOpen(true);
  };

  const handleToggleSelesai = async (id: string, newStatus: boolean) => {
    // Optimistic state update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isSelesai: newStatus } : n))
    );

    try {
      const res = await toggleNotificationStatus(id, newStatus);
      if (res.success) {
        showSuccess(
          newStatus
            ? "Notifikasi ditandai selesai dan tidak lagi ditampilkan ke pengguna"
            : "Notifikasi berhasil diaktifkan kembali"
        );
        router.refresh();
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("cdu_monitoring_sync");
          channel.postMessage({ type: "NOTIFICATION_UPDATED" });
          channel.close();
        }
      } else {
        // Revert on error
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isSelesai: !newStatus } : n))
        );
        alert(res.error || "Gagal memperbarui status notifikasi");
      }
    } catch (err: any) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isSelesai: !newStatus } : n))
      );
      alert(err.message || "Terjadi kesalahan sistem");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formJudul.trim()) {
      setFormError("Judul notifikasi tidak boleh kosong");
      return;
    }
    if (!formPesan.trim()) {
      setFormError("Isi pesan notifikasi tidak boleh kosong");
      return;
    }
    if (formTargetTipe === "PRODI" && !formTargetProdiId) {
      setFormError("Pilih Program Studi target notifikasi");
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateNotificationInput = {
        tipe: "PENGUMUMAN",
        targetTipe: formTargetTipe,
        targetUserId: null,
        targetProdiId: formTargetTipe === "PRODI" ? formTargetProdiId : null,
        targetKelasKode: null,
        isPopupLogin: formIsPopupLogin,
        isSelesai: editingItem ? Boolean(editingItem.isSelesai) : false,
        kadaluarsaPada: formKadaluarsaPada || null,
        judul: formJudul.trim(),
        pesan: formPesan.trim(),
        urgensi: formUrgensi,
        tautanUrl: formTautanUrl.trim() ? formatExternalUrl(formTautanUrl.trim()) : null,
      };

      if (editingItem) {
        // Mode Edit Notifikasi
        const res = await updateNotification(editingItem.id, input);
        if (!res.success || !res.data) {
          setFormError(res.error || "Gagal memperbarui notifikasi");
          setIsSubmitting(false);
          return;
        }

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === editingItem.id
              ? {
                  ...n,
                  judul: input.judul,
                  pesan: input.pesan,
                  urgensi: input.urgensi,
                  targetTipe: input.targetTipe,
                  targetProdiId: input.targetTipe === "PRODI" ? input.targetProdiId : null,
                  tautanUrl: input.tautanUrl || null,
                  isPopupLogin: formIsPopupLogin,
                  targetKelasKode: formIsPopupLogin ? "POPUP_LOGIN" : null,
                  isSelesai: Boolean(editingItem.isSelesai),
                  kadaluarsaPada: formKadaluarsaPada ? new Date(formKadaluarsaPada).toISOString() : null,
                }
              : n
          )
        );

        setIsModalOpen(false);
        setEditingItem(null);
        showSuccess("Notifikasi berhasil diperbarui!");

        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("cdu_monitoring_sync");
          channel.postMessage({ type: "NOTIFICATION_UPDATED" });
          channel.close();
        }
      } else {
        // Mode Buat Notifikasi Baru
        const res = await createNotification(input);
        if (!res.success || !res.data) {
          setFormError(res.error || "Gagal membuat notifikasi");
          setIsSubmitting(false);
          return;
        }

        // Prepend to list
        const newItem: ManagementNotificationItem = {
          ...res.data,
          readCount: 0,
          isPopupLogin: formIsPopupLogin,
          isSelesai: false,
          kadaluarsaPada: formKadaluarsaPada ? new Date(formKadaluarsaPada).toISOString() : null,
          dibuatOleh: { id: "", name: "Anda", role: currentUserRole },
          targetUser: null,
        };

        setNotifications([newItem, ...notifications]);
        setIsModalOpen(false);
        showSuccess("Notifikasi berhasil dipublikasikan ke pengguna!");

        // Trigger sync channel so headers everywhere pick it up
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("cdu_monitoring_sync");
          channel.postMessage({ type: "NOTIFICATION_CREATED" });
          channel.close();
        }
      }
    } catch (err: any) {
      setFormError(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await deleteNotification(id);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setDeleteTargetId(null);
        showSuccess("Notifikasi berhasil dihapus dari sistem");

        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel("cdu_monitoring_sync");
          channel.postMessage({ type: "NOTIFICATION_DELETED" });
          channel.close();
        }
      } else {
        alert(res.error || "Gagal menghapus notifikasi");
      }
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notifikasi */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg animate-fade-in">
          <CheckCircle2 size={16} className="text-white shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Megaphone size={18} className="text-[#a80063]" />
            <span>Pusat Kelola Notifikasi CDU</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Publikasikan pengumuman penting resmi untuk seluruh dosen atau per program studi
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="btn-brand inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus size={14} />
          <span>Buat Notifikasi Baru</span>
        </button>
      </div>

      {/* ── Summary Stats Cards (Urutan: Info Resmi, Peringatan, Urgent / Bahaya, Selesai, Total Notifikasi) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Info Resmi */}
        <div
          onClick={() => {
            if (filterStatus === "AKTIF" && filterUrgensi === "PENTING") {
              setFilterStatus("ALL");
              setFilterUrgensi("ALL");
            } else {
              setFilterStatus("AKTIF");
              setFilterUrgensi("PENTING");
            }
          }}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "AKTIF" && filterUrgensi === "PENTING"
              ? "border-slate-300 bg-slate-50/50 shadow-xs"
              : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/20"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-[#a80063] uppercase tracking-wider">
              Info Resmi
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {totalInfoResmi}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]/70 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </div>
        </div>

        {/* 2. Peringatan */}
        <div
          onClick={() => {
            if (filterStatus === "AKTIF" && filterUrgensi === "PERINGATAN") {
              setFilterStatus("ALL");
              setFilterUrgensi("ALL");
            } else {
              setFilterStatus("AKTIF");
              setFilterUrgensi("PERINGATAN");
            }
          }}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "AKTIF" && filterUrgensi === "PERINGATAN"
              ? "border-slate-300 bg-slate-50/50 shadow-xs"
              : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/20"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Peringatan
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {totalPeringatan}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* 3. Urgent / Bahaya */}
        <div
          onClick={() => {
            if (filterStatus === "AKTIF" && filterUrgensi === "BAHAYA") {
              setFilterStatus("ALL");
              setFilterUrgensi("ALL");
            } else {
              setFilterStatus("AKTIF");
              setFilterUrgensi("BAHAYA");
            }
          }}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "AKTIF" && filterUrgensi === "BAHAYA"
              ? "border-slate-300 bg-slate-50/50 shadow-xs"
              : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/20"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              Urgent / Bahaya
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {totalBahaya}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0">
            <ShieldAlert size={18} />
          </div>
        </div>

        {/* 4. Selesai (Card Baru) */}
        <div
          onClick={() => {
            if (filterStatus === "SELESAI") {
              setFilterStatus("ALL");
            } else {
              setFilterStatus("SELESAI");
              setFilterUrgensi("ALL");
            }
          }}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "SELESAI"
              ? "border-slate-300 bg-slate-50/50 shadow-xs"
              : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/20"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Selesai
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {totalSelesai}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
        </div>

        {/* 5. Total Notifikasi */}
        <div
          onClick={() => {
            setFilterStatus("ALL");
            setFilterUrgensi("ALL");
          }}
          className={`bg-white p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            filterStatus === "ALL" && filterUrgensi === "ALL"
              ? "border-slate-300 bg-slate-50/50 shadow-xs"
              : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/20"
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Total Notifikasi
            </p>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
              {notifications.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/70 flex items-center justify-center shrink-0">
            <Megaphone size={18} />
          </div>
        </div>
      </div>

      {/* ── Standardized Single-Row Filter Toolbar ─────────────────────────── */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/70 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left Controls: Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative w-full sm:w-48 lg:w-64">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  searchQuery ? "text-[#a80063]" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                placeholder="Cari judul, pesan, dosen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-7 pr-7 py-1 text-xs rounded-lg border outline-none transition-all ${
                  searchQuery
                    ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-800 focus:border-[#fbcfe8]"
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Filters & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Target Sasaran */}
            <select
              value={filterTargetTipe}
              onChange={(e) => setFilterTargetTipe(e.target.value as any)}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all max-w-[170px] truncate ${
                filterTargetTipe !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Sasaran Target"
            >
              <option value="ALL">Semua Sasaran</option>
              <option value="SEMUA">Semua Pengguna</option>
              <option value="ROLE_DOSEN">Semua Dosen & Kaprodi</option>
              <option value="PRODI">Per Program Studi</option>
              <option value="USER">Dosen Tertentu</option>
            </select>

            {/* Filter Urgensi */}
            <select
              value={filterUrgensi}
              onChange={(e) => setFilterUrgensi(e.target.value as any)}
              className={`px-2 py-1 text-[11px] rounded-lg border outline-none cursor-pointer font-medium transition-all ${
                filterUrgensi !== "ALL"
                  ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] font-semibold"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
              title="Filter Tingkat Urgensi"
            >
              <option value="ALL">Semua Urgensi</option>
              <option value="PENTING">Info Resmi</option>
              <option value="PERINGATAN">Peringatan</option>
              <option value="BAHAYA">Urgent / Bahaya</option>
            </select>

            {/* Reset All Filters Button */}
            {(searchQuery || filterUrgensi !== "ALL" || filterTargetTipe !== "ALL" || filterStatus !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterUrgensi("ALL");
                  setFilterTargetTipe("ALL");
                  setFilterStatus("ALL");
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#a80063] bg-[#fdf2f8] border border-[#fbcfe8] hover:bg-[#fce7f3] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Reset semua filter ke default"
              >
                <RotateCcw size={10} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Notifikasi Standar CDU Portal */}
      <div className="duralux-card p-0 bg-white overflow-hidden shadow-xs print:shadow-none print:border-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[880px]">
            <thead>
              <tr className="border-b-2 border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-50">
                <th className="py-2.5 px-3 text-center w-12 font-bold">No</th>
                <th className="py-2.5 px-3 w-36 font-bold">Tingkat Urgensi</th>
                <th className="py-2.5 px-4 font-bold">Judul & Isi Pesan</th>
                <th className="py-2.5 px-3 w-48 font-bold">Sasaran Target</th>
                <th className="py-2.5 px-3 w-36 font-bold">Penerbit</th>
                <th className="py-2.5 px-3 text-center w-20 font-bold">Dibaca</th>
                <th className="py-2.5 px-3 text-center w-28 font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 text-xs">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Bell size={28} className="text-slate-300" />
                      <p className="font-bold text-slate-600">Belum ada notifikasi yang sesuai</p>
                      <p className="text-[11px]">
                        Silakan buat notifikasi baru menggunakan tombol di atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const dateFormatted = new Date(item.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-semibold">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Tingkat Urgensi & Status Selesai */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${
                              item.urgensi === "BAHAYA"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : item.urgensi === "PERINGATAN"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : "bg-[#fdf2f8] text-[#a80063] border-[#fbcfe8]"
                            }`}
                          >
                            {item.urgensi === "BAHAYA" ? (
                              <>
                                <AlertTriangle size={11} className="text-rose-600 shrink-0" />
                                <span>Urgent / Mendesak</span>
                              </>
                            ) : item.urgensi === "PERINGATAN" ? (
                              <>
                                <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                                <span>Peringatan</span>
                              </>
                            ) : (
                              <>
                                <Bell size={11} className="text-[#a80063] shrink-0" />
                                <span>Info Resmi</span>
                              </>
                            )}
                          </span>

                          {item.isSelesai && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={10} className="text-emerald-600 shrink-0" />
                              <span>Selesai</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Judul & Isi Pesan */}
                      <td className="py-3 px-4 max-w-md">
                        <p
                          onClick={() => setSelectedDetailItem(item)}
                          className="font-bold text-slate-900 leading-snug cursor-pointer hover:text-[#a80063] transition-colors"
                          title="Klik untuk melihat detail notifikasi"
                        >
                          {item.judul}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                          {item.pesan}
                        </p>

                        {Boolean(item.tautanUrl && formatExternalUrl(item.tautanUrl)) && (
                          <div className="mt-1 flex items-center gap-2">
                            <a
                              href={formatExternalUrl(item.tautanUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#a80063] hover:underline cursor-pointer"
                            >
                              <ExternalLink size={10} />
                              <span>Tautan Lampiran</span>
                            </a>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[10px] text-slate-400">
                          <p className="flex items-center gap-1 font-normal">
                            <Calendar size={10} className="text-slate-400" />
                            <span>{dateFormatted}</span>
                          </p>

                          {item.kadaluarsaPada && (
                            <>
                              <span>•</span>
                              <p className="flex items-center gap-1 font-medium text-amber-600">
                                <Clock size={10} className="text-amber-500 shrink-0" />
                                <span>
                                  Batas Tayang:{" "}
                                  {new Date(item.kadaluarsaPada).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </p>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Sasaran Target */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          {item.targetTipe === "SEMUA" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                              <Users size={12} className="text-slate-400 shrink-0" />
                              <span>Semua Pengguna</span>
                            </span>
                          ) : item.targetTipe === "ROLE_DOSEN" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                              <Users size={12} className="text-[#a80063] shrink-0" />
                              <span>Semua Dosen & Kaprodi</span>
                            </span>
                          ) : item.targetTipe === "PRODI" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                              <BookOpen size={12} className="text-blue-500 shrink-0" />
                              <span>{prodiMap.get(item.targetProdiId || "") || "Prodi Spesifik"}</span>
                            </span>
                          ) : (
                            <div>
                              <p className="font-bold text-slate-900 text-[11px]">
                                {item.targetUser?.name || "Dosen Tertentu"}
                              </p>
                              {item.targetUser?.email && (
                                <p className="text-[10px] text-slate-400 leading-tight">
                                  {item.targetUser.email}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Badge Pop-up Login atau Kode Kelas */}
                          {(item.isPopupLogin || item.targetKelasKode === "POPUP_LOGIN") ? (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 w-fit">
                              <Megaphone size={10} className="text-purple-600 shrink-0" />
                              <span>Pop-up Login</span>
                            </span>
                          ) : item.targetKelasKode ? (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-[#a80063] bg-[#fdf2f8] px-1.5 py-0.5 rounded border border-[#fbcfe8] w-fit">
                              Kelas: {item.targetKelasKode}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Penerbit */}
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-800 text-[11px] leading-tight">
                          {formatPublisherName(item.dibuatOleh?.name, item.dibuatOleh?.role)}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 mt-1">
                          {formatPublisherRole(item.dibuatOleh?.role)}
                        </span>
                      </td>

                      {/* Read Count */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Eye size={10} className="text-slate-400" />
                          <span>{item.readCount}</span>
                        </span>
                      </td>

                      {/* Aksi Standar CDU Portal */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {/* Tombol Detail (Mata) */}
                          <button
                            type="button"
                            onClick={() => setSelectedDetailItem(item)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Lihat Detail Notifikasi"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Tombol Toggle Selesai / Aktifkan Kembali */}
                          <button
                            type="button"
                            id={`btn-toggle-selesai-${item.id}`}
                            onClick={() => handleToggleSelesai(item.id, !item.isSelesai)}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                              item.isSelesai
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                                : "bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 border-slate-200/80"
                            }`}
                            title={
                              item.isSelesai
                                ? "Aktifkan kembali notifikasi ini"
                                : "Tandai Selesai (Hentikan penayangan ke pengguna)"
                            }
                          >
                            {item.isSelesai ? (
                              <RotateCcw size={12} />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                          </button>

                          {/* Tombol Edit (Pensil) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-amber-50 hover:text-amber-700 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Edit Notifikasi"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Tombol Hapus (Sampah) */}
                          <button
                            type="button"
                            onClick={() => setDeleteTargetId(item.id)}
                            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Hapus Notifikasi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Pagination Bar Standar CDU Portal ────────────────────── */}
        <TablePagination
          currentPage={currentPage}
          totalItems={filteredList.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteTargetId && mounted && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Hapus Notifikasi Ini?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Notifikasi ini akan ditarik dan tidak akan lagi muncul di lonceng notifikasi pengguna.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deleteTargetId)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={12} className="animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Form Buat & Edit Notifikasi (Standar /master/kelas) */}
      {isModalOpen && mounted && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            {/* Tombol Tutup Modal */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-30"
              title="Tutup (ESC)"
            >
              <X size={18} />
            </button>

            {/* Header Modal */}
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Megaphone size={16} className="text-[#a80063]" />
              <span>{editingItem ? "Edit Notifikasi" : "Buat Notifikasi Baru"}</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              {editingItem
                ? "Perbarui pengumuman, tingkat urgensi, atau target penerima"
                : "Publikasikan pengumuman atau instruksi resmi CDU"}
            </p>

            {formError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Baris 1: Sasaran Penerima & Program Studi */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 relative z-30">
                <div className={formTargetTipe === "PRODI" ? "sm:col-span-5" : "sm:col-span-12"}>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Sasaran Target Penerima <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    value={formTargetTipe}
                    onChange={(val) => setFormTargetTipe(val as NotificationTarget)}
                    options={[
                      { value: "SEMUA", label: "Semua Pengguna (Broadcast)" },
                      { value: "ROLE_DOSEN", label: "Semua Dosen & Kaprodi" },
                      { value: "PRODI", label: "Khusus Program Studi Tertentu" },
                    ]}
                    placeholder="-- Pilih Sasaran Target --"
                  />
                </div>

                {formTargetTipe === "PRODI" && (
                  <div className="sm:col-span-7 animate-fade-in">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Pilih Program Studi <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      value={formTargetProdiId}
                      onChange={(val) => setFormTargetProdiId(val)}
                      options={targetOptions.prodis.map((p) => ({
                        value: p.id,
                        label: `${p.nama} (${p.kode})`,
                      }))}
                      placeholder="-- Cari & Pilih Program Studi --"
                    />
                  </div>
                )}
              </div>

              {/* Baris 2: Tingkat Urgensi & Batas Waktu Otomatis Selesai (Compact Side-by-Side) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 relative z-10">
                {/* Sisi Kiri: Tingkat Urgensi (7 cols) */}
                <div className="sm:col-span-7">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Tingkat Urgensi <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: "PENTING", label: "Info Resmi" },
                      { val: "PERINGATAN", label: "Peringatan" },
                      { val: "BAHAYA", label: "Urgent" },
                    ].map((k) => (
                      <button
                        key={k.val}
                        type="button"
                        onClick={() => setFormUrgensi(k.val as any)}
                        className={`p-2 rounded-xl text-center border text-xs font-semibold transition-all cursor-pointer ${
                          formUrgensi === k.val
                            ? "bg-[#fdf2f8] border-[#a80063] text-[#a80063] shadow-2xs ring-1 ring-[#a80063]/30"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        {k.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sisi Kanan: Batas Waktu Otomatis Selesai (5 cols) */}
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-slate-400" />
                      <span>Batas Selesai</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={formKadaluarsaPada}
                      onChange={(e) => setFormKadaluarsaPada(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-medium"
                    />
                    {formKadaluarsaPada && (
                      <button
                        type="button"
                        onClick={() => setFormKadaluarsaPada("")}
                        className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer text-[10px]"
                        title="Hapus batas tanggal"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Baris 3: Judul Notifikasi */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Judul Notifikasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="Batas Akhir Pengisian Konten Perkuliahan"
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-medium"
                />
              </div>

              {/* Baris 4: Penjelasan & Isi Pesan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Penjelasan & Isi Pesan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={formPesan}
                  onChange={(e) => setFormPesan(e.target.value)}
                  placeholder="Tuliskan isi pengumuman atau instruksi resmi..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none leading-relaxed transition-all placeholder:text-slate-400 resize-y font-normal"
                />
              </div>

              {/* Baris 5: Tautan Lampiran / Dokumen Terkait (Opsional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Tautan Lampiran / Dokumen</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={formTautanUrl}
                  onChange={(e) => setFormTautanUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-medium"
                />
              </div>

              {/* Baris 6: Opsi Pop-up saat Login */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Megaphone size={13} className="text-[#a80063]" />
                    <span>Tampilkan Pop-up saat Pengguna Login</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Notifikasi akan otomatis muncul sebagai jendela pop-up saat pengguna masuk ke sistem
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={formIsPopupLogin}
                    onChange={(e) => setFormIsPopupLogin(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#a80063]"></div>
                </label>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>{editingItem ? "Simpan Perubahan" : "Kirim Notifikasi"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Detail Notifikasi Lengkap */}
      <NotificationDetailModal
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        notification={selectedDetailItem}
      />
    </div>
  );
}

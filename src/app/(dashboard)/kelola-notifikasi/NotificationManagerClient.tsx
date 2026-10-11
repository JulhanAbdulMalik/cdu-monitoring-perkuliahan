"use client";
// src/app/(dashboard)/kelola-notifikasi/NotificationManagerClient.tsx
// UI Client untuk Pengelolaan Pengumuman & Peringatan Resmi CDU

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Megaphone,
  AlertTriangle,
  Plus,
  Trash2,
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
} from "lucide-react";
import {
  ManagementNotificationItem,
  CreateNotificationInput,
  NotificationType,
  NotificationTarget,
  NotificationUrgency,
  createNotification,
  deleteNotification,
} from "@/actions/notification";

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

  const [notifications, setNotifications] = useState<ManagementNotificationItem[]>(initialNotifications);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUrgensi, setFilterUrgensi] = useState<"ALL" | NotificationUrgency>("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formTargetTipe, setFormTargetTipe] = useState<NotificationTarget>("SEMUA");
  const [formTargetProdiId, setFormTargetProdiId] = useState<string>("");
  const [formJudul, setFormJudul] = useState("");
  const [formPesan, setFormPesan] = useState("");
  const [formUrgensi, setFormUrgensi] = useState<NotificationUrgency>("PENTING");
  const [formTautanUrl, setFormTautanUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Success Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Filtered Notifications
  const filteredList = notifications.filter((item) => {
    if (filterUrgensi !== "ALL" && item.urgensi !== filterUrgensi) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchJudul = item.judul.toLowerCase().includes(q);
      const matchPesan = item.pesan.toLowerCase().includes(q);
      const matchUser = item.targetUser?.name?.toLowerCase().includes(q) || false;
      const matchKelas = item.targetKelasKode?.toLowerCase().includes(q) || false;
      return matchJudul || matchPesan || matchUser || matchKelas;
    }
    return true;
  });

  const totalInfoResmi = notifications.filter((n) => n.urgensi === "PENTING").length;
  const totalPeringatan = notifications.filter((n) => n.urgensi === "PERINGATAN").length;
  const totalBahaya = notifications.filter((n) => n.urgensi === "BAHAYA").length;

  const handleOpenCreateModal = () => {
    setFormTargetTipe("SEMUA");
    setFormUrgensi("PENTING");
    setFormTargetProdiId(targetOptions.prodis[0]?.id || "");
    setFormJudul("");
    setFormPesan("");
    setFormTautanUrl("");
    setFormError("");
    setIsModalOpen(true);
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
        judul: formJudul.trim(),
        pesan: formPesan.trim(),
        urgensi: formUrgensi,
        tautanUrl: formTautanUrl.trim() || null,
      };

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
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Toast Notifikasi */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg animate-fade-in">
          <CheckCircle2 size={16} className="text-white shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Pusat Kelola Notifikasi & Pengumuman CDU
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Publikasikan pengumuman penting resmi untuk seluruh dosen atau salah satu dosen.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#a80063] hover:bg-[#8f0054] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Buat Notifikasi</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Notifikasi Aktif
            </p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              {notifications.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200/70 flex items-center justify-center">
            <Bell size={18} />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#a80063] uppercase tracking-wider">
              Info Resmi
            </p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              {totalInfoResmi}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] flex items-center justify-center">
            <Bell size={18} />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Peringatan & Urgent
            </p>
            <p className="text-xl font-extrabold text-slate-900 mt-0.5">
              {totalPeringatan + totalBahaya}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Pencarian */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Input Search */}
          <div className="relative w-full sm:w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari judul, pesan, dosen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#a80063] outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Segmented Filter */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setFilterUrgensi("ALL")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                filterUrgensi === "ALL"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgensi("PENTING")}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                filterUrgensi === "PENTING"
                  ? "bg-white text-[#a80063] shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-[#a80063]"
              }`}
            >
              <span>Info Resmi ({totalInfoResmi})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgensi("PERINGATAN")}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                filterUrgensi === "PERINGATAN"
                  ? "bg-white text-amber-800 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-amber-800"
              }`}
            >
              <span>Peringatan ({totalPeringatan})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterUrgensi("BAHAYA")}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                filterUrgensi === "BAHAYA"
                  ? "bg-white text-rose-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              <span>Urgent ({totalBahaya})</span>
            </button>
          </div>
        </div>

        <span className="text-[11px] font-medium text-slate-400">
          Menampilkan {filteredList.length} notifikasi
        </span>
      </div>

      {/* Tabel Riwayat Notifikasi */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-3 w-36">Tingkat Urgensi</th>
                <th className="py-3 px-3">Judul & Isi Pesan</th>
                <th className="py-3 px-3 w-48">Sasaran Target</th>
                <th className="py-3 px-3 w-32">Penerbit</th>
                <th className="py-3 px-3 text-center w-24">Dibaca</th>
                <th className="py-3 px-3 text-center w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                filteredList.map((item, idx) => {
                  const dateFormatted = new Date(item.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-400 font-medium">
                        {idx + 1}
                      </td>

                      {/* Tingkat Urgensi */}
                      <td className="py-3 px-3">
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
                              <AlertTriangle size={11} className="text-rose-600" />
                              <span>Urgent / Bahaya</span>
                            </>
                          ) : item.urgensi === "PERINGATAN" ? (
                            <>
                              <AlertTriangle size={11} className="text-amber-600" />
                              <span>Peringatan</span>
                            </>
                          ) : (
                            <>
                              <Bell size={11} className="text-[#a80063]" />
                              <span>Info Resmi</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Judul & Isi Pesan */}
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900 leading-snug">{item.judul}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.pesan}
                        </p>
                        {item.tautanUrl && (
                          <a
                            href={item.tautanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#a80063] hover:underline mt-1"
                          >
                            <span>Lihat Tautan Terkait</span>
                            <ExternalLink size={9} />
                          </a>
                        )}
                        <p className="text-[9.5px] text-slate-400 mt-1 flex items-center gap-1">
                          <Calendar size={10} />
                          <span>{dateFormatted}</span>
                        </p>
                      </td>

                      {/* Sasaran Target */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          {item.targetTipe === "SEMUA" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1 text-[11px]">
                              <Users size={12} className="text-slate-400" />
                              <span>Semua Pengguna</span>
                            </span>
                          ) : item.targetTipe === "ROLE_DOSEN" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1 text-[11px]">
                              <Users size={12} className="text-[#a80063]" />
                              <span>Semua Dosen / Kaprodi</span>
                            </span>
                          ) : item.targetTipe === "PRODI" ? (
                            <span className="font-semibold text-slate-800 flex items-center gap-1 text-[11px]">
                              <BookOpen size={12} className="text-blue-500" />
                              <span>Prodi Spesifik</span>
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

                          {item.targetKelasKode && (
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-[#a80063] bg-[#fdf2f8] px-1.5 py-0.2 rounded border border-[#fbcfe8] w-fit mt-1">
                              Kelas: {item.targetKelasKode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Penerbit */}
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800 text-[11px] leading-tight">
                          {item.dibuatOleh?.name || "Admin CDU"}
                        </p>
                        <span className="text-[9.5px] text-slate-400 leading-tight">
                          {item.dibuatOleh?.role || "Admin"}
                        </span>
                      </td>

                      {/* Read Count */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Eye size={10} className="text-slate-400" />
                          <span>{item.readCount}</span>
                        </span>
                      </td>

                      {/* Aksi Hapus */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(item.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                          title="Hapus Notifikasi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
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
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(deleteTargetId)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={12} className="animate-spin" />}
                <span>Ya, Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Buat Notifikasi Baru (Identik dengan Modal Lapor CDU) */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-4xl bg-white rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto space-y-4">
            {/* Header Modal & Navigasi */}
            <div className="pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Buat Notifikasi Baru
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Publikasikan pengumuman penting atau peringatan resmi dari CDU untuk seluruh dosen atau program studi.
                </p>
              </div>

              {/* Tombol Tutup Modal */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Tutup (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Baris 1: Sasaran Penerima & Program Studi */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className={formTargetTipe === "PRODI" ? "sm:col-span-5" : "sm:col-span-12"}>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sasaran Target Penerima <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formTargetTipe}
                    onChange={(e) => setFormTargetTipe(e.target.value as NotificationTarget)}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white text-xs text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/10 outline-none transition-all cursor-pointer font-medium"
                  >
                    <option value="SEMUA">Semua Pengguna (Broadcast)</option>
                    <option value="ROLE_DOSEN">Semua Dosen & Kaprodi</option>
                    <option value="PRODI">Khusus Program Studi Tertentu</option>
                  </select>
                </div>

                {formTargetTipe === "PRODI" && (
                  <div className="sm:col-span-7 animate-fade-in">
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pilih Program Studi <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formTargetProdiId}
                      onChange={(e) => setFormTargetProdiId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white text-xs text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/10 outline-none transition-all cursor-pointer font-medium"
                    >
                      {targetOptions.prodis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama} ({p.kode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Baris 2: Tingkat Urgensi (Identik dengan Kategori Kendala di Lapor CDU) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tingkat Urgensi <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      val: "PENTING",
                      label: "Info Resmi",
                      desc: "Pengumuman umum atau info perkuliahan resmi",
                    },
                    {
                      val: "PERINGATAN",
                      label: "Peringatan",
                      desc: "Pemberitahuan perhatian dan tindak lanjut",
                    },
                    {
                      val: "BAHAYA",
                      label: "Urgent / Mendesak",
                      desc: "Instruksi mendesak atau atensi kritis",
                    },
                  ].map((k) => (
                    <button
                      key={k.val}
                      type="button"
                      onClick={() => setFormUrgensi(k.val as any)}
                      className={`p-2.5 sm:p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        formUrgensi === k.val
                          ? "bg-[#fdf2f8] border-[#a80063] text-[#a80063] shadow-2xs ring-1 ring-[#a80063]/30"
                          : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{k.label}</p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5 leading-snug">{k.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Baris 3: Judul Notifikasi */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Judul Notifikasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJudul}
                  onChange={(e) => setFormJudul(e.target.value)}
                  placeholder="Tuliskan judul pengumuman atau notifikasi..."
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white text-xs text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/10 outline-none leading-relaxed transition-all placeholder:text-slate-400 font-semibold"
                />
              </div>

              {/* Baris 4: Penjelasan & Isi Pesan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Penjelasan & Isi Pesan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={formPesan}
                  onChange={(e) => setFormPesan(e.target.value)}
                  placeholder="Tuliskan penjelasan detail instruksi, kebijakan, atau uraian notifikasi..."
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white text-xs text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/10 outline-none leading-relaxed transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Baris 5: Tautan URL (Opsional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Tautan Halaman / URL (Opsional)</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">(contoh: /monitoring atau link dokumen pendukung)</span>
                </label>
                <input
                  type="text"
                  value={formTautanUrl}
                  onChange={(e) => setFormTautanUrl(e.target.value)}
                  placeholder="https://... atau /monitoring-perkuliahan"
                  className="w-full px-3.5 py-2 bg-slate-50/70 focus:bg-white text-xs text-slate-900 rounded-xl border border-slate-200 focus:border-[#a80063] focus:ring-2 focus:ring-[#a80063]/10 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Footer Actions (Identik dengan Modal Lapor CDU) */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#a80063] hover:bg-[#8f0054] text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Kirim Notifikasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

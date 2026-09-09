"use client";
// src/app/(dashboard)/kelola-akun/UserManagementClient.tsx
// Antarmuka Manajemen Akun Pengguna (Khusus Super Admin)
// Tema Duralux Modern: Plus Jakarta Sans & Aksen Brand #a80063

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ShieldCheck,
  UserPlus,
  Edit2,
  Trash2,
  Search,
  KeyRound,
  Mail,
  User,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { createUser, updateUser, deleteUser, getUserList } from "@/actions/user";

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "CDU_STAFF";
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: {
    monitoringUpdates: number;
  };
}

interface UserManagementClientProps {
  initialUsers: UserItem[];
  currentUserId: string;
  currentUserEmail: string;
}

export default function UserManagementClient({
  initialUsers,
  currentUserId,
  currentUserEmail,
}: UserManagementClientProps) {
  const [mounted, setMounted] = useState(false);
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form Create States
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newRole, setNewRole] = useState<"SUPER_ADMIN" | "ADMIN" | "CDU_STAFF">("CDU_STAFF");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Form Edit States
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"SUPER_ADMIN" | "ADMIN" | "CDU_STAFF">("CDU_STAFF");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  // Hitung statistik
  const totalUsers = users.length;
  const totalSuperAdmin = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const totalAdmin = users.filter((u) => u.role === "ADMIN").length;
  const totalStaff = users.filter((u) => u.role === "CDU_STAFF").length;

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchRole = filterRole === "ALL" || u.role === filterRole;
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  async function reloadUsers() {
    const res = await getUserList();
    if (res.success && res.data) {
      setUsers(res.data as any);
    }
  }

  function openCreateModal() {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewRole("CDU_STAFF");
    setShowNewPassword(false);
    setIsCreateOpen(true);
  }

  function openEditModal(user: UserItem) {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword("");
    setShowEditPassword(false);
    setIsEditOpen(true);
  }

  function openDeleteModal(user: UserItem) {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      toast.error("Semua bidang wajib diisi");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const res = await createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal membuat akun");
      } else {
        toast.success(`Akun "${newName}" berhasil dibuat!`);
        setIsCreateOpen(false);
        await reloadUsers();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat membuat akun");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    if (!editName.trim() || !editEmail.trim()) {
      toast.error("Nama dan email wajib diisi");
      return;
    }

    if (editPassword && editPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }

    setLoading(true);
    try {
      const res = await updateUser(selectedUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        password: editPassword.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error || "Gagal memperbarui akun");
      } else {
        toast.success("Data akun berhasil diperbarui!");
        setIsEditOpen(false);
        await reloadUsers();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat memperbarui akun");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser() {
    if (!selectedUser) return;
    setLoading(true);

    try {
      const res = await deleteUser(selectedUser.id);
      if (!res.success) {
        toast.error(res.error || "Gagal menghapus akun");
      } else {
        toast.success(`Akun "${selectedUser.name}" berhasil dihapus`);
        setIsDeleteOpen(false);
        await reloadUsers();
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menghapus akun");
    } finally {
      setLoading(false);
    }
  }

  function getRoleBadge(role: "SUPER_ADMIN" | "ADMIN" | "CDU_STAFF") {
    switch (role) {
      case "SUPER_ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-gradient-to-r from-[#fdf2f8] to-[#fce7f3] text-[#a80063] border border-[#fbcfe8] shadow-2xs">
            <ShieldCheck size={11} className="text-[#a80063]" />
            <span>Super Admin</span>
          </span>
        );
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Shield size={11} className="text-blue-500" />
            <span>Administrator</span>
          </span>
        );
      case "CDU_STAFF":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Users size={11} className="text-emerald-600" />
            <span>Staff CDU</span>
          </span>
        );
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#fdf2f8] text-[#a80063] flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <span>Kelola Akun Pengguna</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-1">
            Manajemen hak akses portal CDU. Hanya akun Super Admin yang memiliki hak istimewa untuk membuat dan mengatur akun staf.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-brand inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <UserPlus size={14} />
          <span>Tambah Akun Baru</span>
        </button>
      </div>

      {/* ── Summary Stats Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Akun</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight">{totalUsers}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-[#fbcfe8]/60 bg-gradient-to-br from-white to-[#fdf2f8]/30 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8] flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#a80063] uppercase tracking-wider">Super Admin</p>
            <p className="text-base font-extrabold text-[#a80063] leading-tight">{totalSuperAdmin}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Administrator</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight">{totalAdmin}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
            <User size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Staff CDU</p>
            <p className="text-base font-extrabold text-slate-900 leading-tight">{totalStaff}</p>
          </div>
        </div>
      </div>

      {/* ── Filter Controls Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/70">
        <div className="relative w-full sm:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama atau email akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-slate-50 text-xs rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Filter Peran:</span>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
          >
            <option value="ALL">Semua Peran ({totalUsers})</option>
            <option value="SUPER_ADMIN">Super Admin ({totalSuperAdmin})</option>
            <option value="ADMIN">Administrator ({totalAdmin})</option>
            <option value="CDU_STAFF">Staff CDU ({totalStaff})</option>
          </select>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────────────── */}
      <div className="duralux-card bg-white p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="pb-2.5 font-bold">Pengguna</th>
                <th className="pb-2.5 font-bold">Email</th>
                <th className="pb-2.5 font-bold">Hak Akses (Role)</th>
                <th className="pb-2.5 font-bold">Terdaftar Sejak</th>
                <th className="pb-2.5 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                    Tidak ada data akun pengguna yang sesuai dengan pencarian atau filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUserId || user.email === currentUserEmail;
                  const initials = user.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  const formattedDate = new Date(user.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Nama Pengguna & Avatar */}
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-slate-900 leading-tight">
                                {user.name}
                              </p>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#fdf2f8] text-[#a80063] border border-[#fbcfe8]">
                                  Akun Anda
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                              ID: {user.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 pr-3 font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 pr-3">
                        {getRoleBadge(user.role)}
                      </td>

                      {/* Tanggal Terdaftar */}
                      <td className="py-3 pr-3 text-slate-500 font-normal">
                        {formattedDate}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(user)}
                            className="w-7 h-7 rounded-md bg-slate-50 hover:bg-[#fdf2f8] hover:text-[#a80063] border border-slate-200/80 text-slate-400 flex items-center justify-center transition-all cursor-pointer"
                            title="Edit Data / Reset Password"
                          >
                            <Edit2 size={12} />
                          </button>

                          {/* Tombol Hapus (Disabled jika akun milik sendiri) */}
                          <button
                            onClick={() => openDeleteModal(user)}
                            disabled={isCurrent}
                            className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all ${
                              isCurrent
                                ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50"
                                : "bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border-slate-200/80 text-slate-400 cursor-pointer"
                            }`}
                            title={isCurrent ? "Anda tidak dapat menghapus akun Anda sendiri" : "Hapus Akun"}
                          >
                            <Trash2 size={12} />
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
      </div>

      {/* ── Modal Tambah Akun Baru (Full Screen Portal Blur) ────────────────────────── */}
      {mounted && isCreateOpen && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <UserPlus size={16} className="text-[#a80063]" />
              <span>Tambah Akun Pengguna Baru</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Hanya Super Admin yang berhak mendaftarkan staf baru ke dalam sistem portal CDU.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap & Gelar <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso, S.Kom., M.T."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    placeholder="nama@nusaputra.ac.id"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                </div>
              </div>

              {/* Hak Akses / Role */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Hak Akses (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "CDU_STAFF", label: "Staff CDU", desc: "Akses monitoring" },
                    { val: "ADMIN", label: "Admin", desc: "Akses master & monitoring" },
                    { val: "SUPER_ADMIN", label: "Super Admin", desc: "Akses penuh + kelola akun" },
                  ].map((r) => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setNewRole(r.val as any)}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        newRole === r.val
                          ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/70"
                      }`}
                    >
                      <p className="text-[11px] font-bold leading-tight">{r.label}</p>
                      <p className="text-[9px] text-slate-400 font-normal mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Password Awal <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-8 pr-10 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showNewPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Konfirmasi Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Ulangi password di atas"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan Akun Baru</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal Edit Akun & Reset Password (Full Screen Portal Blur) ────────── */}
      {mounted && isEditOpen && selectedUser && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Edit2 size={15} className="text-[#a80063]" />
              <span>Edit Akun Pengguna</span>
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Perbarui profil, hak akses, atau lakukan reset kata sandi akun pengguna ini.
            </p>

            <form onSubmit={handleEditUser} className="space-y-3.5">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none font-semibold"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Alamat Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                />
              </div>

              {/* Hak Akses / Role */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Hak Akses (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "CDU_STAFF", label: "Staff CDU" },
                    { val: "ADMIN", label: "Admin" },
                    { val: "SUPER_ADMIN", label: "Super Admin" },
                  ].map((r) => (
                    <button
                      key={r.val}
                      type="button"
                      onClick={() => setEditRole(r.val as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center ${
                        editRole === r.val
                          ? "bg-[#fdf2f8] border-[#fbcfe8] text-[#a80063] shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ganti Password (Opsional) */}
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <KeyRound size={13} className="text-[#a80063]" />
                    <span>Ganti / Reset Password</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>
                </div>

                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Masukkan password baru (opsional)"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 bg-white text-xs text-slate-900 rounded-lg border border-slate-200 focus:border-[#a80063] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showEditPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  disabled={loading}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {loading && <Loader2 size={12} className="animate-spin" />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Dialog Konfirmasi Hapus Akun (Full Screen Portal Blur) ─────────────── */}
      {mounted && isDeleteOpen && selectedUser && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDeleteOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center relative">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={22} />
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Hapus Akun Pengguna?
            </h3>
            <p className="text-xs text-slate-500 font-normal mb-4">
              Apakah Anda yakin ingin menghapus akun <strong>{selectedUser.name}</strong> ({selectedUser.email})? Pengguna ini tidak akan dapat masuk kembali ke sistem.
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {loading && <Loader2 size={12} className="animate-spin" />}
                <span>Ya, Hapus Akun</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

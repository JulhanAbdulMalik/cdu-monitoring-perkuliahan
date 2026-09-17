# 🎓 CDU Monitoring - Nusa Putra University

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon.tech-336791?style=for-the-badge&logo=postgresql)](https://neon.tech/)

**CDU Monitoring** adalah sistem informasi manajemen dan monitoring perkuliahan berbasis web terpadu yang dirancang khusus untuk **Curriculum Development Unit (CDU) Universitas Nusa Putra**.

Aplikasi ini mendigitalkan proses pemantauan 16 sesi perkuliahan per semester, standardisasi kelengkapan **3 Pilar Pembelajaran**, validasi kuota **Temu Virtual (Live Conference)**, otomasi import laporan LMS (Edlink/Sevima), penanganan pergantian dosen, pusat pengaduan/sanggahan (**Lapor CDU**), hingga rekapitulasi serta ekspor laporan eksekutif berformat Excel dan cetak PDF.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Konsep Bisnis & Aturan Akademik](#-konsep-bisnis--aturan-akademik)
  - [1. Presensi & Sesi Perkuliahan (16 Sesi)](#1-presensi--sesi-perkuliahan-16-sesi)
  - [2. Evaluasi 3 Pilar Pembelajaran Berpasangan](#2-evaluasi-3-pilar-pembelajaran-berpasangan)
  - [3. Aturan Temu Virtual (Live Conference)](#3-aturan-temu-virtual-live-conference)
  - [4. Diferensiasi Mode Pembelajaran](#4-diferensiasi-mode-pembelajaran)
  - [5. Status Pergantian Dosen](#5-status-pergantian-dosen)
- [Peran Pengguna & Hak Akses (RBAC)](#-peran-pengguna--hak-akses-rbac)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Direktori](#-struktur-direktori)
- [Panduan Instalasi & Menjalankan Aplikasi](#-panduan-instalasi--menjalankan-aplikasi)
  - [Prasyarat Sistem](#prasyarat-sistem)
  - [Langkah-Langkah Instalasi](#langkah-langkah-instalasi)
  - [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
  - [Setup Database & Seeding Data](#setup-database--seeding-data)
  - [Akun Bawaan (Default Seed)](#akun-bawaan-default-seed)
- [Daftar Perintah (NPM Scripts)](#-daftar-perintah-npm-scripts)
- [Panduan Penggunaan Fitur](#-panduan-penggunaan-fitur)
  - [Monitoring Kelas (Grid & List View)](#monitoring-kelas-grid--list-view)
  - [Import Excel Laporan Aktivitas Edlink](#import-excel-laporan-aktivitas-edlink)
  - [Import Massal Data Master](#import-massal-data-master)
  - [Alur Pengaduan Lapor CDU](#alur-pengaduan-lapor-cdu)
  - [Ekspor Laporan & Rekapitulasi](#ekspor-laporan--rekapitulasi)
- [Deployment](#-deployment)
- [Lisensi & Hak Cipta](#-lisensi--hak-cipta)

---

## ✨ Fitur Utama

### 1. 📊 Executive Dashboard & Real-Time Analytics

- **KPI Cards Interaktif**: Total kelas, rata-rata kehadiran dosen, rata-rata kelengkapan 3 pilar, tingkat kepatuhan temu virtual, dan distribusi status evaluasi (_Memenuhi_, _Cukup_, _Perlu Perhatian_).
- **Filter Fleksibel**: Pemfilteran global instan berdasarkan **Semester Aktif**, **Fakultas**, dan **Program Studi**.
- **Grafik Interaktif**: Analisis visual progres perkuliahan menggunakan Recharts.

### 2. 📋 Grid & List View Monitoring Perkuliahan

- **Interactive Session Matrix**: Memantau matriks 16 sesi perkuliahan per kelas secara visual dan responsif.
- **Quick Status Popover**: Modal interaktif untuk mengubah presensi dosen, mencentang materi 3 pilar, menetapkan dosen pengganti, dan menambah catatan verifikasi CDU.
- **Auto Date Generation**: Kalkulasi otomatis tanggal pelaksanaan sesi berdasarkan hari jadwal kelas, tanggal mulai semester, serta kalender libur/minggu tenang.

### 3. 📥 Otomasi Import Excel Edlink LMS

- **Smart Column Detection**: Parser cerdas untuk membaca file laporan aktivitas dari Edlink.id / Sevima.
- **Otomatisasi Komponen**: Otomatis mendeteksi dan menandai ketersediaan Slide/PPT, Modul/LN, Video Pembelajaran, Live Conference, Kuis, dan Tugas per sesi.

### 4. 🗂️ Manajemen Data Master Terpadu & Bulk Import

- **Semester & Kalender Libur**: Pengaturan semester aktif, tanggal mulai perkuliahan, serta daftar hari libur/minggu tenang per semester.
- **Fakultas & Program Studi**: Struktur akademik lengkap Universitas Nusa Putra.
- **Dosen & Mata Kuliah**: Manajemen database dosen (NIDN, email) dan katalog mata kuliah (SKS, kode MK).
- **Kelas & Penjadwalan**: Pengelolaan kode kelas, dosen pengampu, hari, jam, ruangan, serta mode pembelajaran.
- **Bulk Import Excel dengan Preview**: Import massal master Dosen, Mata Kuliah, Kelas, dan Prodi dengan validasi baris, deteksi duplikasi, dan pratinjau sebelum disimpan ke database.

### 5. 🛡️ Pusat Pengaduan & Sanggahan (Lapor CDU)

- **Sistem Tiket Transparan**: Dosen dan staf dapat mengajukan sanggahan data monitoring (misal: presensi alpa karena kendala teknis, sesi Zoom di luar Edlink, revisi dosen pengganti).
- **Bukti Pendukung**: Lampiran tautan rekaman, Google Drive, atau bukti pendukung lainnya.
- **Alur Verifikasi CDU**: Status pengajuan (_Pending_, _Disetujui_, _Ditolak_) dengan catatan resmi staf CDU. Jika disetujui, data monitoring sesi akan terupdate secara otomatis.

### 6. 📈 Pelaporan & Rekapitulasi Eksekutif

- **Rekapitulasi Sesi**: Rangkuman seluruh kelas dalam satu semester dengan kalkulasi statistik lengkap.
- **Laporan per Dosen**: Evaluasi performa dan beban mengajar tiap dosen.
- **Laporan per Prodi**: Tingkat kepatuhan perkuliahan di setiap program studi.
- **Ekspor Excel (.xlsx)**: File spreadsheet siap pakai berformat elegan dan rapi yang digenerate langsung oleh server menggunakan `ExcelJS`.
- **Cetak / Print PDF Ready**: Tampilan bersih siap cetak langsung dari browser.

### 7. 👥 Manajemen Pengguna & Keamanan (RBAC)

- Autentikasi aman berbasis session menggunakan **NextAuth.js v5 (Auth.js)** dan enkripsi password **Bcrypt**.
- **Role-Based Access Control** yang ditegakkan di level Edge Middleware dan Server Actions.
- Menu manajemen akun untuk Super Admin (tambah pengguna, ubah role, reset password).

---

## 📐 Konsep Bisnis & Aturan Akademik

Aplikasi ini mengimplementasikan regulasi baku pemantauan perkuliahan Universitas Nusa Putra:

### 1. Presensi & Sesi Perkuliahan (16 Sesi)

Setiap kelas memiliki tepat 16 sesi perkuliahan:

- **Sesi 1 – 7**: Perkuliahan Reguler Pra-UTS
- **Sesi 8**: Ujian Tengah Semester (UTS)
- **Sesi 9 – 15**: Perkuliahan Reguler Pra-UAS
- **Sesi 16**: Ujian Akhir Semester (UAS)

Status Kehadiran Dosen per sesi:

- `HADIR`: Dosen hadir penuh sesuai jadwal.
- `HADIR_TIDAK_LENGKAP`: Dosen hadir namun tidak memenuhi standar waktu/aktivitas penuh.
- `TIDAK_HADIR`: Alpa / Dosen tidak hadir tanpa pengganti.
- `BELUM_DIISI`: Default sesi yang belum diverifikasi oleh tim CDU.

### 2. Evaluasi 3 Pilar Pembelajaran Berpasangan

Khusus untuk sesi perkuliahan reguler (Sesi 1–7 dan Sesi 9–15), materi dievaluasi berdasarkan **3 Pilar Berpasangan**:

| Pilar                               | Komponen Berpasangan                               | Syarat Terpenuhi            | Poin Maksimal |
| :---------------------------------- | :------------------------------------------------- | :-------------------------- | :-----------: |
| **Pilar 1: Materi Tekstual**        | Slide / PPT **ATAU** Lecture Note / Modul          | Minimal salah satu tersedia |    1 Poin     |
| **Pilar 2: Evaluasi Mandiri**       | Kuis **ATAU** Tugas / Assignment                   | Minimal salah satu tersedia |    1 Poin     |
| **Pilar 3: Interaksi Audio-Visual** | Live Conference (Zoom) **ATAU** Video Pembelajaran | Minimal salah satu tersedia |    1 Poin     |

- **Skor per Sesi Reguler**: Skala 0 s.d. 3 poin (0/3 Kosong, 1/3 Sebagian, 2/3 Baik, 3/3 Sempurna).
- **Total Skor Maksimal Semester**: 14 sesi reguler × 3 = **42 Poin**.
- **Sesi 8 (UTS) & Sesi 16 (UAS)**: Tidak dikenakan penilaian 3 pilar (konten otomatis `null`, hanya dinilai dari presensi kehadiran).

### 3. Aturan Temu Virtual (Live Conference)

Untuk kelas dengan mode pembelajaran **DARING**:

- Wajib menyelenggarakan Live Conference minimal **3 kali** pada Sesi 1 s.d. 7 (Pra-UTS).
- Wajib menyelenggarakan Live Conference minimal **3 kali** pada Sesi 9 s.d. 15 (Pra-UAS).
- Total minimal selama satu semester adalah **6 kali** temu virtual.

### 4. Diferensiasi Mode Pembelajaran

Sistem menyesuaikan kriteria evaluasi berdasarkan mode kelas:

1. **DARING (Online)**:
   - Wajib memenuhi standar 3 Pilar Pembelajaran.
   - Wajib memenuhi kuota Live Conference (minimal 3x pra-UTS & 3x pra-UAS).
2. **LURING (Tatap Muka)**:
   - Evaluasi 3 pilar tetap dinilai untuk materi pendukung LMS.
   - **Bebas** dari kewajiban kuota Live Conference.
3. **BIMBINGAN (Skripsi, TA, Magang, KKN)**:
   - **Bebas 100%** dari penilaian 3 pilar materi LMS.
   - Evaluasi murni dihitung dari 16 sesi presensi pembimbingan dosen dengan mahasiswa.

### 5. Status Pergantian Dosen

Jika dosen utama berhalangan mengajar, sistem mencatat status pengajar per sesi:

- **Dosen Utama (`UTAMA`)**: Diajar oleh dosen tetap kelas tersebut.
- **Pengganti Insidental (`PENGGANTI_INSIDENTAL`)**: Menggantikan hanya pada sesi tertentu saja.
- **Pergantian Tetap (`PERGANTIAN_TETAP`)**: Pergantian resmi dosen pengampu yang berlaku mulai sesi tersebut hingga sesi-sesi berikutnya.

---

## 🔒 Peran Pengguna & Hak Akses (RBAC)

| Modul / Menu                                    |   Super Admin    | Admin (Staff CDU) |    Dosen     |
| :---------------------------------------------- | :--------------: | :---------------: | :----------: |
| **Dashboard Eksekutif**                         |        ✅        |        ✅         |      ✅      |
| **Pusat Pengaduan (Lapor CDU)**                 | ✅ (Verifikator) | ✅ (Verifikator)  | ✅ (Pelapor) |
| **Monitoring Kelas (Grid & Input)**             |        ✅        |        ✅         |      ❌      |
| **Import Excel Aktivitas Edlink**               |        ✅        |        ✅         |      ❌      |
| **Laporan & Rekapitulasi (Excel/PDF)**          |        ✅        |        ✅         |      ✅      |
| **Data Master (Semester, Prodi, Dosen, Kelas)** |        ✅        |        ❌         |      ❌      |
| **Import Massal Data Master**                   |        ✅        |        ❌         |      ❌      |
| **Kelola Akun & Reset Password**                |        ✅        |        ❌         |      ❌      |

---

## 💻 Teknologi yang Digunakan

- **Core Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI & View**: [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [tw-animate-css](https://www.npmjs.com/package/tw-animate-css), [Class Variance Authority (CVA)](https://cva.style/)
- **Komponen UI**: [shadcn/ui](https://ui.shadcn.com/) & [Base UI](https://base-ui.com/)
- **Typography & Desain**: _Plus Jakarta Sans_, Nusa Putra Maroon/Ruby Theme (`#a80063`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database**: [PostgreSQL (Neon Serverless)](https://neon.tech/)
- **ORM**: [Prisma ORM v5](https://www.prisma.io/)
- **Autentikasi**: [NextAuth.js v5 Beta (Auth.js)](https://authjs.dev/)
- **State Management & Fetching**: [TanStack React Query v5](https://tanstack.com/query), [Zustand](https://zustand-demo.pmnd.rs/)
- **Visualisasi Grafik**: [Recharts](https://recharts.org/)
- **Data Table**: [TanStack React Table v9](https://tanstack.com/table)
- **Form & Validasi**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
- **Notifikasi Toast**: [Sonner](https://sonner.emilkowal.ski/)
- **Pengolahan Berkas & Spreadsheet**: [ExcelJS](https://github.com/exceljs/exceljs), [XLSX (SheetJS)](https://sheetjs.com/), [@react-pdf/renderer](https://react-pdf.org/)

---

## 📁 Struktur Direktori

```text
monitoring-perkuliahan/
├── prisma/
│   ├── schema.prisma           # Skema database relasional (User, Sesi, Kelas, Dosen, dsb)
│   └── seed.ts                 # Script seeding data awal (Akun Admin, Prodi, Semester, Kelas)
├── public/                     # Aset statis & logo
├── src/
│   ├── actions/                # Server Actions (Mutasi data & backend logic)
│   │   ├── dosen.ts            # CRUD Dosen
│   │   ├── kelas.ts            # CRUD Kelas & generate 16 sesi
│   │   ├── lapor-cdu.ts        # Alur pengajuan & verifikasi tiket Lapor CDU
│   │   ├── laporan.ts          # Perhitungan rekapitulasi laporan
│   │   ├── master-import.ts    # Parser & import massal data master dari Excel
│   │   ├── mata-kuliah.ts      # CRUD Mata Kuliah
│   │   ├── monitoring.ts       # Update status presensi & konten 3 pilar
│   │   ├── prodi.ts            # CRUD Fakultas & Prodi
│   │   ├── semester.ts         # CRUD Semester & Hari Libur
│   │   └── user.ts             # Manajemen Akun & Hak Akses
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Route grup autentikasi
│   │   │   └── login/          # Halaman login
│   │   ├── (dashboard)/        # Layout dashboard terlindungi
│   │   │   ├── kelola-akun/    # Manajemen Akun (Super Admin)
│   │   │   ├── lapor-cdu/      # Pengaduan & Sanggahan CDU
│   │   │   ├── laporan/        # Rekap Sesi, Laporan Dosen, Laporan Prodi
│   │   │   ├── master/         # Modul Data Master (Semester, Prodi, Dosen, Kelas)
│   │   │   ├── monitoring/     # Grid View & List View Monitoring Sesi
│   │   │   └── page.tsx        # Halaman Utama (Dashboard Eksekutif)
│   │   ├── api/                # API Endpoints
│   │   │   ├── auth/           # NextAuth route handler
│   │   │   └── export/         # API Export Excel (Rekap, Dosen, Prodi via ExcelJS)
│   │   ├── globals.css         # Styling global & token warna #a80063
│   │   ├── layout.tsx          # Root HTML layout & font Plus Jakarta Sans
│   │   └── providers.tsx       # QueryClient & SessionProvider wrapper
│   ├── components/             # Reusable React Components
│   │   ├── dashboard/          # Komponen kartu KPI & chart visualisasi
│   │   ├── layout/             # Sidebar lipat (mini/full), Header, User Menu
│   │   ├── master/             # Modal Form & tabel CRUD master data
│   │   ├── monitoring/         # Grid Matrix, Session Detail Modal, Filter Bar
│   │   └── ui/                 # Atomic UI components (Button, Dialog, Badge, Input, dll)
│   ├── lib/                    # Helper & Logic Core
│   │   ├── auth.config.ts      # Konfigurasi NextAuth Edge-safe
│   │   ├── auth.ts             # Instance NextAuth dengan database credential
│   │   ├── excel-parser.ts     # Engine ekstraksi file Excel aktivitas Edlink
│   │   ├── prisma.ts           # Global singleton Prisma client
│   │   ├── score-calculator.ts # Single Source of Truth perhitungan 3 Pilar & Evaluasi
│   │   └── utils.ts            # Formatting tanggal, string, helper CSS cn()
│   ├── middleware.ts           # Edge Middleware proteksi route & autentikasi
│   └── types/                  # Definisi TypeScript interface & types
├── .env.example                # Template konfigurasi environment variable
├── components.json             # Konfigurasi shadcn/ui
├── next.config.ts              # Konfigurasi Next.js
├── package.json                # Dependensi & script NPM
└── tsconfig.json               # Konfigurasi TypeScript
```

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### Prasyarat Sistem

Pastikan perangkat Anda telah terpasang:

- **Node.js**: Versi `20.x` atau lebih baru
- **NPM** atau **PNPM** atau **Yarn**
- Database **PostgreSQL** (disarankan menggunakan [Neon.tech](https://neon.tech) serverless)

---

### Langkah-Langkah Instalasi

1. **Clone repositori proyek:**

   ```bash
   git clone https://github.com/username/cdu-monitoring-perkuliahan.git
   cd cdu-monitoring-perkuliahan
   ```

2. **Install dependensi:**

   ```bash
   npm install
   ```

3. **Buat file environment `.env.local`:**
   Salin dari template `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

---

### Konfigurasi Environment Variables

Buka file `.env.local` dan lengkapi variabel berikut:

```env
# ── Database (Neon.tech / PostgreSQL) ─────────────────────────────────────────
# Connection string dengan PgBouncer pooling untuk koneksi aplikasi harian
DATABASE_URL="postgresql://username:password@ep-xxxx.ap-southeast-1.aws.neon.tech/cdu_monitoring?sslmode=require&pgbouncer=true"

# Connection string Direct (Direct URL) untuk migrasi skema Prisma
DIRECT_URL="postgresql://username:password@ep-xxxx.ap-southeast-1.aws.neon.tech/cdu_monitoring?sslmode=require"

# ── NextAuth.js ───────────────────────────────────────────────────────────────
# URL aplikasi (sesuaikan saat production)
NEXTAUTH_URL="http://localhost:3000"

# Secret Key minimal 32 karakter (Generate via: openssl rand -base64 32)
NEXTAUTH_SECRET="your-super-secret-key-minimum-32-characters-here"

# ── Konfigurasi Aplikasi ──────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME="CDU Monitoring - Nusa Putra University"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

### Setup Database & Seeding Data

1. **Sinkronisasi Skema Database:**
   Jalankan migrasi Prisma untuk membuat tabel di PostgreSQL:

   ```bash
   npm run db:migrate
   ```

   _(Atau gunakan `npx prisma db push` jika menggunakan database development)_

2. **Generate Prisma Client:**

   ```bash
   npm run db:generate
   ```

3. **Jalankan Seeding Data Awal:**
   Perintah ini akan membuat data akun bawaan, fakultas, program studi contoh, semester aktif, dan kelas percontohan:

   ```bash
   npm run db:seed
   ```

4. **Jalankan Server Development:**
   ```bash
   npm run dev
   ```
   Buka browser Anda di `http://localhost:3000`.

---

## 📜 Daftar Perintah (NPM Scripts)

| Perintah              | Deskripsi                                                      |
| :-------------------- | :------------------------------------------------------------- |
| `npm run dev`         | Menjalankan server lokal Next.js dalam mode development        |
| `npm run build`       | Melakukan compile Prisma Client dan build production Next.js   |
| `npm run start`       | Menjalankan build production Next.js                           |
| `npm run lint`        | Menjalankan linter ESLint untuk pengecekan kode                |
| `npm run db:migrate`  | Membuat dan menerapkan migrasi database baru dengan Prisma     |
| `npm run db:seed`     | Menjalankan script seeding data awal dari `prisma/seed.ts`     |
| `npm run db:generate` | Melakukan regenerate Prisma Client dari `prisma/schema.prisma` |
| `npm run db:studio`   | Membuka antarmuka grafis GUI Prisma Studio di browser          |

---

## 📖 Panduan Penggunaan Fitur

### Monitoring Kelas (Grid & List View)

1. Buka menu **Monitoring > Monitoring Kelas**.
2. Pilih Semester Aktif, Fakultas, dan Prodi yang ingin ditinjau.
3. Anda dapat beralih antara tampilan **Grid Matrix** (rekomendasi untuk melihat progres 16 sesi sekaligus) atau **List View**.
4. Klik pada kotak nomor sesi (misal: Sesi 3) untuk membuka popover interaktif:
   - Pilih status kehadiran (_Hadir_, _Alpha_, _Hadir Tidak Lengkap_).
   - Centang ketersediaan materi (_Lecture Note_, _Slide_, _Video_, _Conference_, _Tugas_, _Kuis_).
   - Tetapkan dosen pengganti jika kelas diampu oleh pengajar lain.
   - Klik **Simpan Perubahan**.

### Import Excel Laporan Aktivitas Edlink

1. Di halaman **Monitoring Kelas**, klik tombol **Import Excel Edlink**.
2. Unggah file spreadsheet hasil unduhan "Laporan Aktivitas" dari Edlink.id.
3. Sistem secara otomatis mencocokkan nama mata kuliah dan kelas.
4. Periksa pratinjau status 3 pilar yang terdeteksi, lalu konfirmasi untuk menyimpan langsung ke database.

### Import Massal Data Master

1. Masuk sebagai **Super Admin**, buka salah satu sub-menu di **Data Master** (misal: _Data Dosen_ atau _Data Perkuliahan_).
2. Klik tombol **Import Excel**.
3. Unduh format template yang telah disediakan.
4. Isi data pada file template, lalu unggah kembali file tersebut.
5. Sistem akan menampilkan pratinjau baris data valid dan baris error (jika ada data yang belum lengkap atau prodi tidak terdaftar).
6. Klik **Simpan Data Valid**.

### Alur Pengaduan Lapor CDU

1. Dosen atau admin membuka menu **Lapor CDU**.
2. Klik **Buat Laporan Baru**, pilih kelas, nomor sesi yang ingin disanggah, kategori laporan (misal: _Temu Virtual di Luar Edlink_ atau _Kesalahan Presensi_), deskripsi kendala, serta tautan bukti.
3. Tim CDU meninjau laporan di menu **Lapor CDU**, memeriksa bukti, lalu memilih **Setujui** atau **Tolak** dengan catatan.
4. Jika disetujui, data sesi monitoring akan langsung diperbarui secara otomatis.

### Ekspor Laporan & Rekapitulasi

1. Buka menu **Laporan**:
   - **Rekapitulasi Sesi**: Rangkuman seluruh kelas per semester.
   - **Laporan per Dosen**: Rekapitulasi mengajar per individu dosen.
   - **Laporan per Prodi**: Rekapitulasi komparasi antar prodi.
2. Gunakan filter untuk menyesuaikan data yang ingin dianalisis.
3. Klik tombol **Ekspor Excel (.xlsx)** untuk mengunduh laporan spreadsheet resmi berformat rapi, atau klik **Cetak / PDF** untuk pratinjau cetak.

---

## 🌐 Deployment

Aplikasi ini siap dideploy ke platform modern seperti **Vercel**:

1. Pastikan database PostgreSQL di [Neon.tech](https://neon.tech) sudah aktif.
2. Push repository kode ke GitHub / GitLab.
3. Buat proyek baru di [Vercel](https://vercel.com).
4. Tambahkan Environment Variables di dashboard Vercel:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_URL` (Domain production Anda, contoh: `https://monitoring-cdu.nusaputra.ac.id`)
   - `NEXTAUTH_SECRET`
   - `NEXT_PUBLIC_APP_NAME`
   - `NEXT_PUBLIC_APP_URL`
5. Vercel akan otomatis menjalankan `npm run build` yang mencakup `prisma generate` dan Next.js production build.

---

## 📄 Lisensi & Hak Cipta

Hak Cipta © 2026 **Julhan A Malik (CDU) - Universitas Nusa Putra**.  
Seluruh hak cipta dilindungi undang-undang. Sistem ini dikembangkan untuk kebutuhan operasional internal Universitas Nusa Putra.

# Integrasi Edlink (API untuk worker sinkronisasi)

Endpoint machine-to-machine agar monitoring 16 sesi dapat diisi **otomatis** dari Edlink,
menggantikan/melengkapi import Excel manual. Semua endpoint berada di `/api/integrasi/*`,
tidak memakai sesi login NextAuth, melainkan **Bearer API key**.

## Konfigurasi

| Env | Keterangan |
|---|---|
| `INTEGRASI_API_KEYS` | Daftar API key valid, dipisah koma, min. 32 karakter. Kosong = semua endpoint integrasi mati (503). |

Buat key: `openssl rand -hex 32`. Simpan di env Coolify, **jangan** di repo.

## Perubahan skema (Prisma)

- `Kelas.edlinkGroupId Int? @unique` — ID kelas Edlink (`https://edlink.id/classes/<id>`).
- `Kelas.edlinkSyncedAt DateTime?` — waktu sinkron terakhir.
- `enum SumberData` + `EDLINK_API`.

Tambahan kolom bersifat nullable sehingga aman untuk data existing. Terapkan dengan
`npx prisma db push` (proyek ini belum memakai folder `migrations`).

## Endpoint

### `GET /api/integrasi/kelas`
Query: `semesterId` (default semester aktif), `prodiId`, `hanyaTerpetakan=1`.
Mengembalikan daftar kelas + `edlinkGroupId`, jadwal, dosen, prodi.

### `POST /api/integrasi/kelas`
Pemetaan massal ID Edlink.
```json
{ "items": [ { "kelasId": "cmuaw...", "edlinkGroupId": 2126659 } ] }
```
Respons: `{ diperbarui, gagal: [{ kelasId, error }] }`. ID Edlink yang sudah dipakai kelas lain ditolak.

### `POST /api/integrasi/sesi`
Worker mengirim data **mentah** respons Edlink `sections/all/{groupId}` untuk satu kelas.
CDU yang menerjemahkan (lihat `src/lib/edlink-mapper.ts`) memakai aturan yang sama dengan
parser Excel (Slide/LN, Tugas/Kuis, Video/Conference).

```json
{
  "edlinkGroupId": 2126659,
  "sections": [ ... ],
  "mode": "merge",
  "isiKehadiran": false,
  "dryRun": true
}
```

Aturan penyimpanan (aman terhadap input staf CDU):

- **merge** (default): komponen konten hanya dinaikkan ke `true`, tidak pernah menghapus centang.
- **overwrite**: konten ditimpa persis Edlink, **kecuali** sesi yang berisi data manual staf (dilewati & dilaporkan di `lewati`).
- **Tanggal** hanya diisi bila kosong. Tanggal CDU sudah memperhitungkan hari libur, jadi selisih dengan Edlink dilaporkan di `selisihJadwal`, tidak ditimpa.
- **Kehadiran** tidak disentuh, kecuali `isiKehadiran=true`, nilai saat ini `BELUM_DIISI`, dan sesi sudah dibuka dosen di Edlink → `HADIR`.
- Sesi 8 (UTS) & 16 (UAS): konten tetap `null`.
- Section milik grup Edlink lain ditolak (409). Idempoten: kiriman ulang data yang sama = 0 perubahan.
- `dryRun=true` → hanya menghitung `perubahan` tanpa menulis.

### `GET /api/integrasi/ringkasan?tanggal=YYYY-MM-DD`
Untuk notifikasi (bot Telegram/asisten): sesi hari itu yang 3 pilarnya belum lengkap,
jumlah sesi lampau tanpa konten, kelas belum terpetakan, kelas belum disinkron > 24 jam.

## Contoh

```bash
curl -H "Authorization: Bearer $KEY" https://<host>/api/integrasi/kelas?hanyaTerpetakan=1
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d @sesi_ti24b.json https://<host>/api/integrasi/sesi
```

## Keamanan

- Route `/api/integrasi/*` dikecualikan dari middleware login, tetapi **setiap** handler
  memanggil `checkIntegrasiAuth()` (perbandingan key konstan-waktu).
- Disarankan membatasi akses jaringan (internal/Tailscale) di reverse proxy.

## Tombol "Cek Edlink" (per kelas)

Di halaman monitoring kelas (`/monitoring/{kelasId}`) ada tombol **Cek Edlink** (khusus
SUPER_ADMIN/ADMIN) yang menarik data 16 sesi kelas tersebut langsung dari Edlink.

Alur:

1. Klik tombol → server action `mintaCekEdlink` membuat baris `EdlinkCekRequest` (PENDING).
   Klik ganda dalam 3 menit memakai permintaan yang sama.
2. Worker `edlink-sync` mengklaim antrian via `POST /api/integrasi/cek/ambil`
   (atomik, `FOR UPDATE SKIP LOCKED`), mengambil sesi dari Edlink, lalu mengirim ke
   `POST /api/integrasi/sesi` (mode merge: hanya menambah centang).
3. Worker melapor ke `POST /api/integrasi/cek/{id}/selesai` (`SELESAI`/`GAGAL` + ringkasan).
4. Tombol memantau status tiap 2,5 detik, lalu memperbarui grid dan menampilkan ringkasan
   (contoh: "2 sesi diperbarui — S2: LN, Slide, Tugas, Kuis").

Tombol dinonaktifkan bila kelas belum punya `edlinkGroupId` atau ada perubahan yang belum disimpan.
Permintaan PROSES yang macet > 10 menit dikembalikan ke antrian; PENDING > 30 menit ditandai GAGAL.

Skema baru: model `EdlinkCekRequest` + enum `StatusEdlinkCek` (terapkan dengan `npx prisma db push`).

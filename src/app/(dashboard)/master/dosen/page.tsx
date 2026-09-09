// src/app/(dashboard)/master/dosen/page.tsx
// Halaman master dosen telah disatukan ke Data Perkuliahan (/master/kelas)
import { redirect } from "next/navigation";

export default function MasterDosenPage() {
  redirect("/master/kelas");
}

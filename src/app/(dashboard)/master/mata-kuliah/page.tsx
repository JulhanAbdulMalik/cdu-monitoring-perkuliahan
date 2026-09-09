// src/app/(dashboard)/master/mata-kuliah/page.tsx
// Halaman master mata kuliah telah disatukan ke Data Perkuliahan (/master/kelas)
import { redirect } from "next/navigation";

export default function MasterMataKuliahPage() {
  redirect("/master/kelas");
}

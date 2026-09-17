// src/app/(dashboard)/monitoring/import/page.tsx
// Redirect route - Akses Import Edlink kini terpusat via Popup Modal langsung pada halaman monitoring per kelas

import { redirect } from "next/navigation";

export default function ImportPage() {
  redirect("/monitoring");
}

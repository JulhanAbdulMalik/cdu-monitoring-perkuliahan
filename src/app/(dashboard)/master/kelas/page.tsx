// src/app/(dashboard)/master/kelas/page.tsx
// Master Kelas Page

import { Metadata } from "next";
import { getKelasList } from "@/actions/kelas";
import KelasClient from "./KelasClient";

export const metadata: Metadata = {
  title: "Data Master Perkuliahan",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MasterKelasPage() {
  const res = await getKelasList();
  const data = res.success
    ? res.data!
    : {
        kelas: [],
        semesters: [],
        mataKuliah: [],
        dosen: [],
        prodi: [],
        activeSemesterId: "",
      };

  return (
    <KelasClient
      initialKelas={data.kelas as any}
      semesters={data.semesters as any}
      mataKuliahList={data.mataKuliah as any}
      dosenList={data.dosen as any}
      prodiList={data.prodi as any}
      defaultSemesterId={data.activeSemesterId || ""}
    />
  );
}

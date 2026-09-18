// src/app/(dashboard)/master/mata-kuliah/page.tsx
// Data Master Mata Kuliah Page

import { Metadata } from "next";
import { getMataKuliahList } from "@/actions/mata-kuliah";
import MataKuliahClient from "./MataKuliahClient";

export const metadata: Metadata = {
  title: "Data Master Mata Kuliah",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MasterMataKuliahPage() {
  const res = await getMataKuliahList();
  const data = res.success && res.data ? res.data : { mataKuliah: [], prodiList: [] };

  return (
    <MataKuliahClient
      initialMataKuliah={data.mataKuliah as any}
      prodiList={data.prodiList as any}
    />
  );
}

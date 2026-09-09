// src/app/(dashboard)/master/prodi/page.tsx
// Master Fakultas & Program Studi Page

import { Metadata } from "next";
import { getFakultasAndProdi } from "@/actions/prodi";
import ProdiClient from "./ProdiClient";

export const metadata: Metadata = {
  title: "Data Master Fakultas & Program Studi",
};

export default async function MasterProdiPage() {
  const res = await getFakultasAndProdi();
  const data = res.success ? res.data! : { fakultas: [], prodi: [] };

  return (
    <ProdiClient
      initialFakultas={data.fakultas as any}
      initialProdi={data.prodi as any}
    />
  );
}

// src/app/(dashboard)/master/dosen/page.tsx
// Master Dosen Page

import { Metadata } from "next";
import { getDosenList } from "@/actions/dosen";
import DosenClient from "./DosenClient";

export const metadata: Metadata = {
  title: "Data Master Dosen",
};

export default async function MasterDosenPage() {
  const res = await getDosenList();
  const data = res.success ? res.data! : { dosen: [], prodiList: [] };

  return (
    <DosenClient
      initialDosen={data.dosen as any}
      prodiList={data.prodiList as any}
    />
  );
}

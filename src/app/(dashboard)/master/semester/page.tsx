// src/app/(dashboard)/master/semester/page.tsx
// Master Semester Page

import { Metadata } from "next";
import { getSemesters } from "@/actions/semester";
import SemesterClient from "./SemesterClient";

export const metadata: Metadata = {
  title: "Data Master Semester",
};

export default async function MasterSemesterPage() {
  const res = await getSemesters();
  const semesters = res.success ? res.data! : [];

  return <SemesterClient initialData={semesters as any} />;
}

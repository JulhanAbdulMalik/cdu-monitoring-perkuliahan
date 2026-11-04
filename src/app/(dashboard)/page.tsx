// src/app/(dashboard)/page.tsx
// CDU Portal - Real-Data Dashboard (Plus Jakarta Sans)
// Optimized with High-Speed Aggregated Queries & Single-Flight In-Memory Cache

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import DashboardMetricSection from "@/components/dashboard/DashboardMetricSection";
import MonitoringTrendChart from "@/components/dashboard/MonitoringTrendChart";
import StatusDonutChart from "@/components/dashboard/StatusDonutChart";
import RecentClassesTable from "@/components/dashboard/RecentClassesTable";
import { getDashboardData } from "@/actions/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();

  const userRole = (session?.user as any)?.role;
  const userProdiIds = ((session?.user as any)?.prodiIds as string[]) || [];
  const isDosen = userRole === "DOSEN";
  const userName = session?.user?.name || "Admin";

  const data = await getDashboardData({
    isDosen,
    userProdiIds,
  });

  const {
    activeSemester,
    currentActiveSesi,
    totalKelas,
    totalProdi,
    totalDosen,
    kelasOffline,
    kelasOnline,
    kelasBimbingan,
    kelasPerluPerhatianCount,
    totalAlpha,
    totalHadir,
    totalSesiTerlaksana,
    totalSesiBerjalan,
    targetSesiBerjalan,
    avgKehadiranBerjalan,
    avgKontenBerjalan,
    persenProgresMonitoringBerjalan,
    belumDimonitorSesiBerjalan,
    totalJadwalSesi,
    totalKelasNonBimbingan,
    avgKehadiranSemester,
    avgKontenSemester,
    persenProgresMonitoringSemester,
    belumDimonitorSemester,
    trendData,
    trendDataByMode,
    donutData,
    distributionByMode,
    recentClassesList,
  } = data;

  return (
    <div className="space-y-4">
      {/* ── 1. Top Greeting, Mode Toggle & 4 Stat Cards ─────────────────────── */}
      <DashboardMetricSection
        userName={userName}
        semesterText={
          activeSemester
            ? `${activeSemester.tahunAkademik} (${activeSemester.periode})`
            : "Aktif"
        }
        currentActiveSesi={currentActiveSesi}
        totalKelas={totalKelas}
        totalProdi={totalProdi}
        totalDosen={totalDosen}
        kelasOffline={kelasOffline}
        kelasOnline={kelasOnline}
        kelasBimbingan={kelasBimbingan}
        kelasPerluPerhatianCount={kelasPerluPerhatianCount}
        totalAlpha={totalAlpha}
        berjalan={{
          avgKehadiran: avgKehadiranBerjalan,
          totalHadir,
          totalSesiTerlaksana: totalSesiBerjalan,
          targetSesiBerjalan,
          avgKonten: avgKontenBerjalan,
          persenProgresMonitoring: persenProgresMonitoringBerjalan,
          belumDimonitorSesiBerjalan,
        }}
        full={{
          avgKehadiran: avgKehadiranSemester,
          totalHadir,
          totalJadwalSesi,
          avgKonten: avgKontenSemester,
          totalKelasNonBimbingan,
          persenProgresMonitoring: persenProgresMonitoringSemester,
          belumDimonitorSemester,
        }}
      />

      {/* ── 2. Middle Row: Unified Trend Spline Chart & Donut Distribution Chart ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <div className="lg:col-span-2">
          <MonitoringTrendChart
            trendDataByMode={trendDataByMode}
            sessionData={trendData}
          />
        </div>

        <div className="lg:col-span-1">
          <StatusDonutChart
            distributionByMode={distributionByMode}
            data={donutData}
            totalSesi={totalSesiTerlaksana}
          />
        </div>
      </div>

      {/* ── 3. Bottom Row: Status Monitoring Kelas Terkini (Full Width) ────────── */}
      <div>
        <RecentClassesTable classes={recentClassesList} />
      </div>
    </div>
  );
}

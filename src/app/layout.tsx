// src/app/layout.tsx
// Root layout - Font dimuat via next/font/google (zero render-blocking), metadata, providers

import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Rokkitt } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// ─── Font: Plus Jakarta Sans (font utama UI) ────────────────────────────────
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

// ─── Font: Rokkitt (font aksen / heading branding) ──────────────────────────
const rokkitt = Rokkitt({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-rokkitt",
  display: "swap",
  preload: false, // hanya dipakai di beberapa heading, tidak perlu preload
});

export const metadata: Metadata = {
  title: {
    default: "CDU Portal - Nusa Putra University",
    template: "%s | CDU Portal",
  },
  description:
    "Sistem monitoring kinerja dosen Curriculum Development Unit (CDU) Universitas Nusa Putra.",
  keywords: ["CDU", "monitoring", "dosen", "Nusa Putra", "perkuliahan"],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} ${rokkitt.variable}`}>
      <body className="antialiased selection:bg-[#fce7f3] selection:text-[#a80063]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

// src/app/layout.tsx
// Root layout - Google Fonts: Plus Jakarta Sans, metadata, providers

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "CDU Monitoring - Nusa Putra University",
    template: "%s | CDU Monitoring",
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
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-[#fce7f3] selection:text-[#a80063]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

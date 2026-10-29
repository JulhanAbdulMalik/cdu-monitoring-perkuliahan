"use client";
// src/app/providers.tsx
// Client-side providers: NextAuth Session + TanStack Query + NProgress Navigation Bar

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { AppProgressBar as NProgress } from "next-nprogress-bar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 menit
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* ─── NProgress: Top Loading Bar saat navigasi antar halaman ─── */}
        <NProgress
          height="2.5px"
          color="#a80063"
          options={{
            showSpinner: false,
            trickleSpeed: 200,
            minimum: 0.08,
            easing: "ease",
            speed: 400,
          }}
          shallowRouting
        />
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  );
}

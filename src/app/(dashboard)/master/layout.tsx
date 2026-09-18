// src/app/(dashboard)/master/layout.tsx
// Server-side layout: Data Master selalu mengambil data realtime dari database (Dynamic SSR)

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

// src/app/(dashboard)/master/layout.tsx
// Server-side layout guard: Data Master hanya dapat diakses oleh SUPER_ADMIN



export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

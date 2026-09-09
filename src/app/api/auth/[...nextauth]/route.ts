// src/app/api/auth/[...nextauth]/route.ts
// NextAuth.js v5 API Route Handler

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

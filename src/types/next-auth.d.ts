import { DefaultSession } from "next-auth";

export interface UserProdiInfo {
  id: string;
  nama: string;
  kode: string;
}

declare module "next-auth" {
  interface User {
    role?: string;
    prodiIds?: string[];
    prodis?: UserProdiInfo[];
    prodiNames?: string[];
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
      prodiIds?: string[];
      prodis?: UserProdiInfo[];
      prodiNames?: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    prodiIds?: string[];
    prodis?: UserProdiInfo[];
    prodiNames?: string[];
  }
}


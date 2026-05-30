"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";

const AdminPage = nextDynamic(() => import("@/views/AdminPage"), {
  ssr: false,
});

export default function Page() {
  return <AuthProvider><AdminPage /></AuthProvider>;
}

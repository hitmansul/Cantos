"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";

const HomePage = nextDynamic(() => import("@/views/Home"), {
  ssr: false,
});

export default function Page() {
  return <AuthProvider><HomePage /></AuthProvider>;
}

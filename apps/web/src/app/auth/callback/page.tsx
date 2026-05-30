"use client";

import nextDynamic from "next/dynamic";

import { AuthProvider } from "@/lib/auth-shim";

const AuthCallback = nextDynamic(() => import("@/views/AuthCallback"), {
  ssr: false,
});

export default function Page() {
  return <AuthProvider><AuthCallback /></AuthProvider>;
}

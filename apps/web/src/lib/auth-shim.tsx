"use client";

import type { ReactNode } from "react";
import { authClient, useSession } from "./auth-client";

// Mocha's @getmocha/users-service/react exposes a richer useAuth() than
// better-auth's useSession. We approximate the Mocha surface so user code
// keeps compiling. `exchangeCodeForSessionToken` is a no-op because
// better-auth handles the OAuth callback itself via /api/auth/[...all].
export function useAuth() {
  const session = useSession();
  const signOut = () => authClient.signOut();
  // Mocha's redirectToLogin accepts no args; user code commonly attaches it
  // directly to onClick, so don't tighten the signature.
  const redirectToLogin = () => {
    if (typeof window !== "undefined") window.location.href = "/account/signin";
  };
  return {
    user: session.data?.user ?? null,
    isPending: session.isPending,
    loading: session.isPending,
    error: session.error ?? null,
    signOut,
    logout: signOut,
    refetch: session.refetch,
    fetchUser: session.refetch,
    redirectToLogin,
    exchangeCodeForSessionToken: async () => {
      // better-auth completes OAuth on the server; nothing to do client-side.
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

type AuthError = { message: string };
type AuthResult = Promise<{ error: AuthError | null }>;
type ClientSession = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
} | null;

const disabledError: AuthError = {
  message: 'Login temporariamente desativado nesta versao publica.',
};

export const authClient = {
  signIn: {
    async social(_options?: unknown): AuthResult {
      return { error: disabledError };
    },
    async email(_options?: unknown): AuthResult {
      return { error: disabledError };
    },
  },
  signUp: {
    async email(_options?: unknown): AuthResult {
      return { error: disabledError };
    },
  },
  async signOut(): AuthResult {
    return { error: null };
  },
};

export function useSession() {
  return {
    data: null as ClientSession,
    isPending: false,
    error: null,
    refetch: async () => ({ data: null, error: null }),
  };
}

export const { signIn, signUp, signOut } = authClient;

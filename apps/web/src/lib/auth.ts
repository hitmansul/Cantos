import argon2 from 'argon2';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export type Session = {
  user: SessionUser;
  session: {
    id?: string;
    token: string;
    expiresAt?: Date | string;
  };
};

export const auth = {
  api: {
    async getSession(_options?: { headers?: Headers }): Promise<Session | null> {
      return null;
    },
  },
  $context: Promise.resolve({
    password: {
      hash(password: string) {
        return argon2.hash(password, {
          type: argon2.argon2id,
        });
      },
    },
  }),
};

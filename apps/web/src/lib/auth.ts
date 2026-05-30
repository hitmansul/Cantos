/**
 * ⚠ ANYTHING PLATFORM — DO NOT REWRITE THIS FILE ⚠
 *
 * Shipped v2 better-auth configuration. The hooks.before middleware (backfills
 * `name` from email), bearer() plugin (mobile Authorization: Bearer flow), and
 * trustedOrigins list are ALL load-bearing. A prior AI removed the name
 * backfill and broke every signup with [body.name] validation errors. DO NOT
 * simplify this config without understanding why each piece is present.
 *
 *   Safe:   add user fields to `user.additionalFields`, tune session options.
 *   Unsafe: removing hooks.before, the bearer plugin, or trustedOrigins;
 *           changing cookie attributes (sameSite:'none' is required for
 *           mobile iframes); changing the database pool.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { bearer } from 'better-auth/plugins';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Resolve the app's canonical URL for OAuth redirect URI generation.
// Better Auth REQUIRES this to build the Google callback URL correctly.
// Falls back through all available URL env vars.
// ⚠️ Strip trailing slash — BETTER_AUTH_URL often ends with "/" which would
// produce a double-slash callback URL like: .../app//api/auth/callback/google
const rawAppUrl =
  process.env.BETTER_AUTH_URL ??
  process.env.AUTH_URL ??
  process.env.NEXT_PUBLIC_CREATE_APP_URL ??
  undefined;

const appUrl = rawAppUrl ? rawAppUrl.replace(/\/+$/, '') : undefined;

// Origins we accept auth requests from. Include every URL the app may be
// served under so better-auth's CSRF check doesn't reject legitimate requests
// as "Invalid origin". The request's own origin + known sandbox / published
// URLs + the mobile iframe proxy URL are all listed here.
const trustedOrigins = [
  appUrl,
  process.env.EXPO_PUBLIC_PROXY_BASE_URL,
  process.env.NEXT_PUBLIC_CREATE_BASE_URL,
  process.env.NEXT_PUBLIC_CREATE_APP_URL,
  process.env.NEXT_PUBLIC_CREATE_HOST ? `https://${process.env.NEXT_PUBLIC_CREATE_HOST}` : null,
].filter((v): v is string => Boolean(v));

export const auth = betterAuth({
  // Only set baseURL if we have a value — passing undefined crashes Better Auth
  ...(appUrl ? { baseURL: appUrl } : {}),
  // Explicit secret — reads BETTER_AUTH_SECRET first, falls back to AUTH_SECRET
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET,
  database: pool,
  trustedOrigins,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Explicitly set redirectURI so Better Auth never has to guess/build it.
      // This is the most robust fix for the trailing-slash / double-slash bug.
      ...(appUrl ? { redirectURI: `${appUrl}/api/auth/callback/google` } : {}),
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  hooks: {
    // better-auth's /sign-up/email schema requires `name`. Generated user apps
    // often collect only email+password, so backfill a name from the email
    // local-part to keep signup working without a visible name field.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      const body = ctx.body as { email?: unknown; name?: unknown } | undefined;
      if (!body || typeof body.email !== 'string') return;
      if (typeof body.name === 'string' && body.name.trim().length > 0) return;
      const derived = body.email.split('@')[0];
      body.name = derived && derived.length > 0 ? derived : 'User';
    }),
  },
  advanced: {
    cookiePrefix: 'better-auth',
    defaultCookieAttributes: {
      sameSite: 'none', // Required for iframes
      secure: true,
      httpOnly: true,
      path: '/',
    },
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: 'none', // Required for iframes
          secure: true,
        },
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  user: {
    additionalFields: {
      image: {
        type: 'string',
        required: false,
      },
    },
  },
  // Enable Authorization: Bearer <session-token> so mobile apps (which can't
  // carry cookies through a WebView) authenticate API calls with the token
  // returned from /api/auth/token.
  plugins: [bearer()],
});

export type Session = typeof auth.$Infer.Session;

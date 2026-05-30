import { createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE_NAME = 'admin_session';
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export interface AdminTokenPayload {
  adminId: number;
  email: string;
  mustChangePassword: boolean;
}

interface SignedAdminTokenPayload extends AdminTokenPayload {
  exp: number;
}

function getSecret(): string {
  const secret = process.env.ADMIN_JWT_SECRET ?? process.env.AUTH_SECRET ?? process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET, AUTH_SECRET or CRON_SECRET is required for admin sessions');
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function signAdminToken(payload: AdminTokenPayload): string {
  const signedPayload: SignedAdminTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ADMIN_COOKIE_MAX_AGE,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(signedPayload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const received = Buffer.from(signature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SignedAdminTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return {
      adminId: payload.adminId,
      email: payload.email,
      mustChangePassword: payload.mustChangePassword,
    };
  } catch {
    return null;
  }
}

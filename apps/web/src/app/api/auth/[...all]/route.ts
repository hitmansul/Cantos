/**
 * ⚠ ANYTHING PLATFORM — DO NOT REWRITE THIS FILE ⚠
 *
 * Shipped v2 better-auth catch-all. `toNextJsHandler(auth)` wires up every
 * better-auth endpoint (/sign-up/email, /sign-in/email, /get-session, ...).
 * Do not hand-roll your own routes for these paths; it will conflict with
 * this handler and break signup/signin/session lookup.
 */
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextRequest, NextResponse } from 'next/server';

const authHandler = toNextJsHandler(auth);

export async function GET(req: NextRequest) {
  try {
    return await authHandler.GET(req);
  } catch (err) {
    console.error('[better-auth GET error]', err);
    return NextResponse.json(
      {
        error: 'auth_internal_error',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    return await authHandler.POST(req);
  } catch (err) {
    console.error('[better-auth POST error]', err);
    return NextResponse.json(
      {
        error: 'auth_internal_error',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined,
      },
      { status: 500 }
    );
  }
}

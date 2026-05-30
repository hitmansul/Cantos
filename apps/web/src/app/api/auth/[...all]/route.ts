import { NextResponse } from 'next/server';

const disabledResponse = {
  error: 'auth_disabled',
  message: 'Login temporariamente desativado nesta versao publica.',
};

export async function GET() {
  return NextResponse.json(disabledResponse, { status: 404 });
}

export async function POST() {
  return NextResponse.json(disabledResponse, { status: 404 });
}

import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { getAdminSession } from '@/app/api/utils/adminAuth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getAdminSession(request);
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Prevent removing self
  const selfAdmin =
    await sql`SELECT * FROM admin_users WHERE user_id = ${adminUser.id} AND id = ${id}`;
  if (selfAdmin.length > 0)
    return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });

  await sql`DELETE FROM admin_users WHERE id = ${id}`;
  return NextResponse.json({ success: true });
}

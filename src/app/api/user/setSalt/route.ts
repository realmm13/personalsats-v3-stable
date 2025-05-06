import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const currentHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(currentHeaders) });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { salt } = await request.json();
    if (!salt || typeof salt !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid salt' }, { status: 400 });
    }
    await db.user.update({
      where: { id: session.user.id },
      data: { encryptionSalt: salt },
    });
    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error in /api/user/setSalt:', err);
    return NextResponse.json({ error: 'Failed to set salt' }, { status: 500 });
  }
} 
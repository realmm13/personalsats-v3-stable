// @ts-nocheck
import { auth } from "@/server/auth";
import { NextRequest } from 'next/server';

export { auth };

export interface SessionUser {
  userId: string;
  encryptionPhrase: string;
}

export async function getUserFromSession(
  req: NextRequest
): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || !session.user) {
    throw new Error('Not authenticated');
  }
  const userId = session.user.id;
  const encryptionPhrase = (session.user as any).encryptionPhrase as string | undefined;
  if (!encryptionPhrase) {
    throw new Error('Missing encryption phrase');
  }
  return { userId, encryptionPhrase };
} 
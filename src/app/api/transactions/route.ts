import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { headers } from 'next/headers';
import { transactionSchema } from "@/schemas/transaction-schema";
import {
  generateEncryptionKey,
  decryptString,
} from "@/lib/encryption";
import { selectLotsForSale, type CostBasisMethod } from "../../../lib/cost-basis";
import type { Lot } from "@prisma/client";
import { processTransaction, BadRequestError } from "@/lib/transactions/process";

// Schema for the incoming API request wrapper
const wrapperSchema = z.object({
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date string"),
  encryptedData: z.string(),
});

export async function GET() {
  try {
    const currentHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(currentHeaders) });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await db.bitcoinTransaction.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(currentHeaders) });
    if (!session?.user?.id || !(session.user as any).encryptionPhrase) {
        console.error("Unauthorized or incomplete session for POST", { userId: session?.user?.id, hasPhrase: !!(session?.user as any)?.encryptionPhrase });
        return NextResponse.json({ error: "Unauthorized or session incomplete" }, { status: 401 });
    }

    const body = await request.json();

    const result = await processTransaction(body, {
        user: {
            id: session.user.id,
            encryptionPhrase: (session.user as any).encryptionPhrase,
            accountingMethod: (session.user as any).accountingMethod
        }
    });

    return NextResponse.json({ id: result.id, status: "success" });

  } catch (err: any) {
    console.error("Error processing transaction:", err);
    
    if (err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: "Failed to process transaction due to an unexpected error." },
      { status: 500 } 
    );
  }
} 
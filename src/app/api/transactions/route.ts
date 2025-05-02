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

// Schema for validating URL query parameters (optional)
const filterSchema = z.object({
  type: z.enum(["buy", "sell", "deposit", "withdrawal"]).optional(), // Adjust enum as needed
  minValue: z.string().refine((val) => !isNaN(parseFloat(val)), { message: "minValue must be a number" }).optional(),
  maxValue: z.string().refine((val) => !isNaN(parseFloat(val)), { message: "maxValue must be a number" }).optional(),
  // Add other potential filters like wallet, tag, dateFrom, dateTo
  // wallet: z.string().optional(),
  // tag: z.string().optional(),
  // dateFrom: z.string().datetime({ message: "Invalid date format for dateFrom" }).optional(),
  // dateTo: z.string().datetime({ message: "Invalid date format for dateTo" }).optional(),
});

export async function GET(request: Request) {
  try {
    const currentHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(currentHeaders) });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get URL search parameters
    const { searchParams } = new URL(request.url);
    const filters = {
      type: searchParams.get('type'),
      minValue: searchParams.get('minValue'),
      maxValue: searchParams.get('maxValue'),
      // Get other filters
      // wallet: searchParams.get('wallet'), 
      // tag: searchParams.get('tag'),
      // dateFrom: searchParams.get('dateFrom'),
      // dateTo: searchParams.get('dateTo'),
    };

    // Validate filters (optional but recommended)
    // const validationResult = filterSchema.safeParse(filters);
    // if (!validationResult.success) {
    //   return NextResponse.json({ error: "Invalid filter parameters", details: validationResult.error.flatten() }, { status: 400 });
    // }
    // const validatedFilters = validationResult.data;

    // Build the Prisma where clause dynamically
    const where: any = { userId: session.user.id }; // Start with user ID

    // Filtering logic removed - fetching all user transactions
    // Client-side will handle filtering after decryption

    const transactions = await db.bitcoinTransaction.findMany({
      where, // Apply the dynamically built where clause (now just userId)
      orderBy: {
        timestamp: "desc",
      },
    });

    // Important Note on Decryption:
    // This endpoint currently returns raw transactions, including the encryptedData blob.
    // Filtering based on encrypted fields (like amount, fee, notes etc.) is NOT possible 
    // at the database level here. If you need to filter by those, you must fetch
    // all relevant transactions, decrypt them server-side or client-side, 
    // and then apply the filter.
    // Filtering here is limited to unencrypted fields (userId, timestamp, potentially price, type, tags, wallet IF stored unencrypted).

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
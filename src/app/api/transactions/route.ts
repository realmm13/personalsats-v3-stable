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

    // Only select decrypted fields, no decryption logic
    const transactions = await db.bitcoinTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        userId: true,
        timestamp: true,
        type: true,
        amount: true,
        asset: true,
        price: true,
        priceAsset: true,
        fee: true,
        feeAsset: true,
        wallet: true,
        counterparty: true,
        tags: true,
        notes: true,
        exchangeTxId: true,
        encryptedData: true,
      },
    });

    return NextResponse.json(transactions);
  } catch (err: any) {
    // Log the error for debugging
    console.error("Error in /api/transactions GET:", err);

    // Return the error message in the response for easier debugging
    return NextResponse.json(
      { error: "Failed to fetch transactions.", details: err?.message || err },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const currentHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(currentHeaders) });
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    console.log('POST /api/transactions payload:', body);

    // Expecting encryptedData and all clear fields
    const { encryptedData, type, amount, price, fee, timestamp, wallet, tags, notes } = body;

    if (
      typeof encryptedData !== 'string' ||
      typeof type !== 'string' ||
      typeof amount !== 'number' ||
      typeof price !== 'number' ||
      typeof fee !== 'number' ||
      typeof timestamp !== 'string' ||
      typeof wallet !== 'string' ||
      !Array.isArray(tags) ||
      typeof notes !== 'string'
    ) {
      console.error('Invalid payload fields:', body);
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      );
    }

    // Store both encryptedData and clear fields
    const record = await db.bitcoinTransaction.create({
      data: {
        encryptedData,
        type,
        amount,
        price,
        fee,
        timestamp: new Date(timestamp),
        wallet,
        tags,
        notes,
        userId: session.user.id,
      },
    });

    // Run processTransaction logic on the clear fields (if needed)
    // (If your processTransaction expects the clear fields, call it here)

    return NextResponse.json(record);
  } catch (err: any) {
    console.error('Error in POST /api/transactions:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
} 
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { headers } from 'next/headers';
import { transactionSchema } from "@/schemas/transaction-schema";

// Define the specific schema for the POST API payload
const transactionApiSchema = z.object({
  timestamp: z.string().datetime(),
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    // Use the API-specific schema
    const parsed = transactionApiSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid API data format", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get timestamp and encryptedData
    const { timestamp, encryptedData } = parsed.data;

    // Save timestamp and encryptedData, set others to null/defaults
    const transaction = await db.bitcoinTransaction.create({
      data: {
        timestamp: new Date(timestamp),
        encryptedData: encryptedData,
        userId: session.user.id,
        type: null, 
        amount: null,
        price: null,
        fee: null,
        wallet: null,
        tags: [], 
        notes: null,
      },
    });

    // Return minimal success response
    return NextResponse.json({ id: transaction.id, status: "success" });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
} 
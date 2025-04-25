import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { headers } from 'next/headers';

const transactionSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: z.number().positive(),
  price: z.number().gte(0),
  fee: z.number().gte(0).optional().default(0),
  timestamp: z.string().datetime(),
  wallet: z.string().min(1),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
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
    const parsed = transactionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid transaction data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, amount, price, fee, timestamp, wallet, tags, notes } = parsed.data;

    const transaction = await db.bitcoinTransaction.create({
      data: {
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

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
} 
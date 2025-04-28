import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transaction = await db.bitcoinTransaction.findUnique({
      where: {
        id: params.id,
        userId: session.user.id, // Ensure user owns the transaction
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership before deleting
    const transaction = await db.bitcoinTransaction.findUnique({
        where: { id: params.id },
        select: { userId: true } 
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden - You do not own this transaction' }, { status: 403 });
    }

    await db.bitcoinTransaction.delete({
      where: {
        id: params.id,
        // No need for userId here again, we already checked ownership
      },
    });

    return NextResponse.json({ message: 'Transaction deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- Add PUT Handler ---
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { encryptedData, timestamp } = body; // Expect encryptedData and potentially new timestamp

    if (!encryptedData) {
      return NextResponse.json({ error: 'Missing encryptedData' }, { status: 400 });
    }
    
    // Verify ownership before updating
    const transaction = await db.bitcoinTransaction.findUnique({
        where: { id: params.id },
        select: { userId: true } 
    });

    if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.userId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden - You do not own this transaction' }, { status: 403 });
    }

    // Prepare update data - only update fields that are provided
    const updateData: { encryptedData: string; timestamp?: Date } = {
      encryptedData: encryptedData,
    };

    if (timestamp) {
      try {
        updateData.timestamp = new Date(timestamp); // Validate and convert timestamp if provided
      } catch (dateError) {
        return NextResponse.json({ error: 'Invalid timestamp format' }, { status: 400 });
      }
    }

    const updatedTransaction = await db.bitcoinTransaction.update({
      where: {
        id: params.id,
        // No userId needed here, checked above
      },
      data: updateData,
    });

    return NextResponse.json(updatedTransaction, { status: 200 });
  } catch (error) {
    console.error("Error updating transaction:", error);
    // Handle potential JSON parsing errors etc.
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
// --- End PUT Handler --- 
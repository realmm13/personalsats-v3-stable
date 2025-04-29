import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SECRET = process.env.CRON_SECRET

/**
 * Compute the total cost basis and market value of a user's BTC holdings as of a given date.
 * Uses the PriceHistory table to get historical BTC/USD rates.
 */
async function computePortfolioSnapshot(userId: string, asOf: Date) {
  // 1. Load all allocations for the user up to 'asOf'
  // Ensure Allocation model exists and has qty, costUsd, and transaction relation
  const allocations = await prisma.allocation.findMany({ 
    where: { transaction: { userId, timestamp: { lte: asOf } } },
    // Only select necessary fields if possible
    select: { qty: true, costUsd: true }
  })

  // 2. Fetch the nearest historical price at or before the snapshot time once
  const priceRecord = await prisma.priceHistory.findFirst({
    where: { timestamp: { lte: asOf } },
    orderBy: { timestamp: 'desc' }
  })
  const price = priceRecord?.priceUsd ?? 0 // Default to 0 if no price found
  if (price === 0) {
      console.warn(`Using price 0 for snapshot value calculation for user ${userId} on ${asOf.toISOString()} as no historical price was found.`);
  }

  let totalCost = 0
  let totalValue = 0

  // 3. Sum cost and compute value using the fetched price
  for (const alloc of allocations) {
     // Add null checks for safety, although select should guarantee presence if model is correct
     if (alloc.costUsd == null || alloc.qty == null) continue;
     totalCost += alloc.costUsd
     totalValue += alloc.qty * price
  }

  // Ensure results are numbers
  totalCost = isNaN(totalCost) ? 0 : totalCost;
  totalValue = isNaN(totalValue) ? 0 : totalValue;

  return { totalCost, totalValue }
}

export async function POST(request: Request) {
  // Authenticate via secret header
  const incoming = request.headers.get('x-cron-secret')
  if (!incoming || incoming !== SECRET) {
    console.warn("CRON API: Unauthorized attempt received.") 
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
   if (!SECRET) {
      console.error("CRON API: CRON_SECRET environment variable not set.")
      return NextResponse.json({ error: 'Configuration error: Missing secret' }, { status: 500 })
  }

  // Determine snapshot date = yesterday UTC at midnight
  const now = new Date()
  const target = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
    0, 0, 0, 0
  ))

  console.log(`CRON API: Starting snapshot generation for date: ${target.toISOString().slice(0,10)}`);
  
  try { 
    // Fetch all users
    const users = await prisma.user.findMany({ select: { id: true } })
    let successCount = 0; 
    let errorCount = 0;

    // Compute & upsert snapshot for each user
    for (const { id: userId } of users) {
      try { 
         console.log(`CRON API: Processing user ${userId}...`); 
        const { totalCost, totalValue } = await computePortfolioSnapshot(userId, target)
        console.log(`CRON API: User ${userId} snapshot - Cost: ${totalCost.toFixed(2)}, Value: ${totalValue.toFixed(2)}`); // Log calculated values

        // Ensure your unique constraint name in schema.prisma matches `userId_date`
        await prisma.dailySnapshot.upsert({
          where: { userId_date: { userId, date: target } }, 
          create: { userId, date: target, totalCost, totalValue },
          update: { totalCost, totalValue }
        })
        successCount++;
      } catch (userError) {
          console.error(`CRON API: Failed to process snapshot for user ${userId}:`, userError);
          errorCount++;
      }
    }
    
    const message = `Snapshot generation complete. Processed ${users.length} users. Success: ${successCount}, Errors: ${errorCount}.`; 
    console.log(`CRON API: ${message}`); 
    return NextResponse.json({ ok: true, message });

  } catch (globalError) { 
      console.error("CRON API: Global error during snapshot generation:", globalError);
      return NextResponse.json({ error: "Internal server error during snapshot generation" }, { status: 500 });
  }
} 
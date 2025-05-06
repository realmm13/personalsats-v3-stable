import { type NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db"; // Assuming db client is in lib
import { serverEnv } from "@/env/server"; // Correct import

// Define the structure of the CryptoCompare API response
interface CryptoCompareResponse {
  Response: string;
  Message: string;
  HasWarning: boolean;
  Type: number;
  RateLimit: any;
  Data: {
    Aggregated: boolean;
    TimeFrom: number;
    TimeTo: number;
    Data: { // This is the array of price points
      time: number;      // Unix timestamp (seconds)
      high: number;
      low: number;
      open: number;
      volumefrom: number;
      volumeto: number;
      close: number;     // Closing price for the minute
      conversionType: string;
      conversionSymbol: string;
    }[];
  };
}

// Function to fetch a batch of historical minute data
async function fetchPriceBatch(toTimestamp: number): Promise<CryptoCompareResponse["Data"]["Data"]> {
  const limit = 2000; // Max limit for histominute
  const apiKey = serverEnv.CRYPTOCOMPARE_API_KEY;
  const url = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=BTC&tsym=USD&limit=${limit}&toTs=${toTimestamp}&api_key=${apiKey}`;

  console.log(`Fetching batch up to timestamp: ${new Date(toTimestamp * 1000).toISOString()}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CryptoCompare API error: ${response.status} - ${errorText}`);
  }

  const data: CryptoCompareResponse = await response.json();

  if (data.Response === "Error") {
    throw new Error(`CryptoCompare API Error: ${data.Message}`);
  }

  return data.Data.Data; // Return the array of price points
}

export async function POST(req: NextRequest) {
  // --- Security Check ---
  const cronSecret = req.headers.get('x-cron-secret');
  // Use serverEnv
  if (cronSecret !== serverEnv.CRON_SECRET) {
    console.warn("Unauthorized cron attempt detected.");
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ---------------------

  console.log("Cron job: Starting price backfill...");
  const MAX_BATCHES_PER_RUN = 10; // Limit requests per cron run to avoid timeouts/rate limits
  let batchesFetched = 0;
  let totalPointsAdded = 0;

  try {
    // 1. Determine start time
    const lastEntry = await db.priceHistory.findFirst({
      orderBy: { timestamp: 'desc' },
    });
    
    // Default start: beginning of 2017 (adjust if needed)
    const defaultStartTimestamp = Date.UTC(2017, 0, 1) / 1000; 
    let currentTimestamp = lastEntry ? lastEntry.timestamp.getTime() / 1000 : defaultStartTimestamp;
    const endTimestamp = Math.floor(Date.now() / 1000); // Now

    console.log(`Last entry: ${lastEntry ? lastEntry.timestamp.toISOString() : 'None'}. Starting backfill from ${new Date(currentTimestamp * 1000).toISOString()}`);

    // Fetch data working backwards from now towards currentTimestamp
    let fetchUptoTimestamp = endTimestamp;

    while (fetchUptoTimestamp > currentTimestamp && batchesFetched < MAX_BATCHES_PER_RUN) {
        const batchData = await fetchPriceBatch(fetchUptoTimestamp);
        batchesFetched++;
        
        if (!batchData || batchData.length === 0) {
            console.log("No more data returned from API or empty batch.");
            break; 
        }

        // Filter data points older than or equal to our current latest timestamp
        const newDataPoints = batchData.filter(point => point.time > currentTimestamp);
        
        if (newDataPoints.length === 0) {
             // Still need to advance the timestamp if the *whole batch* was old
             if (batchData[0]?.time) { // Check if batchData[0] exists
                fetchUptoTimestamp = batchData[0].time - 60; 
             } else {
                 console.warn("Empty batchData encountered unexpectedly after initial check.");
                 break; // Safety break
             }
             console.log("All points in batch already covered or older. Moving to next earlier batch.");
             continue;
        }

        // Prepare data for upsert
        const upsertData = newDataPoints.map(point => ({
            timestamp: new Date(point.time * 1000),
            priceUsd: point.close,
        }));

        // Upsert into database
        const result = await db.priceHistory.createMany({
            data: upsertData,
            skipDuplicates: true, 
        });
        
        totalPointsAdded += result.count;
        // Safely access oldest point timestamp
        const oldestTimestampLog = newDataPoints[0]?.time ? new Date(newDataPoints[0].time*1000).toISOString() : 'N/A';
        console.log(`Upserted ${result.count} new price points. Oldest in batch: ${oldestTimestampLog}`);

        // Set the timestamp for the next fetch iteration 
        // Safely access oldest point time
        if (newDataPoints[0]?.time) {
            fetchUptoTimestamp = newDataPoints[0].time - 60; 
        } else {
             console.warn("newDataPoints[0] was unexpectedly undefined after length check.");
             break; // Safety break
        }

        // Update our marker of the latest data we have locally
        // Safely access newest point time
        const newestPointTime = newDataPoints[newDataPoints.length - 1]?.time;
        if (newestPointTime) {
             currentTimestamp = Math.max(currentTimestamp, newestPointTime);
        }
    }

    const completionMessage = batchesFetched >= MAX_BATCHES_PER_RUN ? 
        `Reached max batches (${MAX_BATCHES_PER_RUN}). More data may exist.` : 
        "Backfill caught up to the latest data.";

    console.log(`Cron job: Price backfill finished. Added ${totalPointsAdded} points. ${completionMessage}`);
    return NextResponse.json({ success: true, pointsAdded: totalPointsAdded, message: completionMessage });

  } catch (error) {
    console.error("[CRON_PRICE_BACKFILL_ERROR]", error);
    return NextResponse.json({ error: 'Internal Server Error during backfill' }, { status: 500 });
  }
} 
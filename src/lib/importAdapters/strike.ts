import { parseISO } from 'date-fns';
import type { Transaction } from '@/lib/types'; // Import canonical type

// Define the expected raw row structure from PapaParse (dynamicTyping=true)
interface StrikeRawRow {
  'Transaction ID': string;
  'Initiated Date (UTC)': string;
  'Initiated Time (UTC)': string;
  'Completed Date (UTC)': string; 
  'Completed Time (UTC)': string;
  'Transaction Type': 'Trade' | 'Deposit' | 'Withdrawal' | 'Onchain' | 'Lightning' | string; // Allow other strings
  'State': 'Completed' | 'Pending' | 'Reversed' | string;
  'Amount 1': number | null;
  'Currency 1': string | null;
  'Fee 1': number | null;
  'Amount 2': number | null;
  'Currency 2': string | null;
  'Fee 2': number | null;
  'BTC Price': number | null;
  'Balance 1 Currency': string | null;
  'Balance 1 Change': number | null;
  'Balance - BTC Destination': string | null; // Use for counterparty on withdrawals/sends?
  // Include other potential columns if necessary
}

// Define the output structure (canonical transaction + potentially metadata)
interface ProcessedImportRow {
  data?: Partial<Transaction>; // Use Partial as not all fields might be derived
  error?: string;
  skipped?: boolean;
  reason?: string; // Add reason field
  needsReview?: boolean;
  needsPrice?: boolean; // Flag if price needs backfill
  sourceRow: StrikeRawRow;
}

// Helper to parse Strike's date/time format
function parseStrikeTimestamp(dateStr: string, timeStr: string): Date | null {
    if (!dateStr || !timeStr) return null;
    try {
        // Example format: "Apr 24 2024", "21:28:16"
        // Adjust parsing logic based on actual observed format if different
        const dateTimeString = `${dateStr} ${timeStr} UTC`; // Assume UTC
        // This parsing might be fragile, consider date-fns parse if needed
        const parsed = new Date(dateTimeString);
        if (isNaN(parsed.getTime())) throw new Error('Invalid date object');
        return parsed;
    } catch (e) {
        console.error(`Failed to parse timestamp: ${dateStr} ${timeStr}`, e);
        return null;
    }
}

export function processStrikeCsv(rawData: StrikeRawRow[]): ProcessedImportRow[] {
  const processedRows: ProcessedImportRow[] = [];
  const tradesById: Record<string, StrikeRawRow[]> = {};

  // --- Phase 1: Filter, Group Trades, Process Non-Trades --- 
  for (const row of rawData) {
    // Filter by State
    if (row.State !== 'Completed') {
      processedRows.push({ skipped: true, reason: 'State not Completed', sourceRow: row });
      continue;
    }

    // Group Trade rows by Transaction ID
    if (row['Transaction Type'] === 'Trade') {
      const txId = row['Transaction ID'];
      if (!tradesById[txId]) {
        tradesById[txId] = [];
      }
      tradesById[txId].push(row);
    } 
    // Skip Onchain/Lightning for now
    else if (row['Transaction Type'] === 'Onchain' || row['Transaction Type'] === 'Lightning') {
      processedRows.push({ skipped: true, reason: `Skipping ${row['Transaction Type']} type`, sourceRow: row });
    } else {
      processedRows.push({ skipped: true, reason: `Unsupported type: ${row['Transaction Type']}`, sourceRow: row });
    }
  }

  // --- Phase 2: Process Aggregated Trades --- 
  for (const txId in tradesById) {
    const tradeRows = tradesById[txId];
    if (!tradeRows || tradeRows.length === 0) continue;
    const firstRowForContext = tradeRows[0]; // Assign here

    // Check if firstRowForContext is valid before proceeding
    if (!firstRowForContext) {
        console.warn(`No first row found for trade ID ${txId} despite length check.`);
        continue; // Skip this trade group if something is wrong
    }

    // Aggregate (3.4)
    let sumUsd = 0;
    let sumBtc = 0;
    let sumFeeUsd = 0;
    let earliestTimestamp: Date | null = null;

    for (const row of tradeRows) {
      const timestamp = parseStrikeTimestamp(row['Completed Date (UTC)'], row['Completed Time (UTC)']);
      if (timestamp && (!earliestTimestamp || timestamp < earliestTimestamp)) {
          earliestTimestamp = timestamp;
      }
      
      if (row['Currency 1'] === 'USD') sumUsd += row['Amount 1'] ?? 0;
      if (row['Currency 2'] === 'USD') sumUsd += row['Amount 2'] ?? 0;
      if (row['Currency 1'] === 'BTC') sumBtc += row['Amount 1'] ?? 0;
      if (row['Currency 2'] === 'BTC') sumBtc += row['Amount 2'] ?? 0;
      sumFeeUsd += row['Fee 1'] ?? 0; // Assuming Fee 1 is USD
    }

    if (!earliestTimestamp) {
        // firstRowForContext is guaranteed to exist here
        processedRows.push({ error: 'Could not determine timestamp for trade', sourceRow: firstRowForContext }); 
        continue;
    }
    
    let tradeType: 'buy' | 'sell' | undefined = undefined;
    if (sumUsd < 0 && sumBtc > 0) tradeType = 'buy';
    else if (sumUsd > 0 && sumBtc < 0) tradeType = 'sell';
    
    const absBtc = Math.abs(sumBtc);
    const absUsd = Math.abs(sumUsd);

    if (!tradeType || absBtc === 0) {
      // firstRowForContext is guaranteed to exist here
      processedRows.push({ needsReview: true, error: 'Could not determine trade type or zero BTC amount', sourceRow: firstRowForContext });
      continue;
    }
    
    const price = absUsd / absBtc; // Effective price (VWAP)
    const fee = Math.abs(sumFeeUsd);
    const feeAsset = fee > 0 ? 'USD' : undefined;

    processedRows.push({
      data: {
        exchangeTxId: txId,
        timestamp: earliestTimestamp,
        type: tradeType,
        amount: absBtc,
        asset: 'BTC',
        price: price,
        priceAsset: 'USD',
        fee: fee > 0 ? fee : undefined,
        feeAsset: feeAsset,
        wallet: 'Strike',
      },
      needsPrice: false, // Price is calculated
      // firstRowForContext is guaranteed to exist here
      sourceRow: firstRowForContext, 
    });
  }

  console.log(`Strike Adapter: Processed ${rawData.length} raw rows into ${processedRows.filter(r => r.data).length} canonical records, ${processedRows.filter(r => r.skipped).length} skipped, ${processedRows.filter(r => r.error).length} errors, ${processedRows.filter(r => r.needsReview).length} for review.`);
  return processedRows;
} 
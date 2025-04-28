// src/lib/importAdapters/river.ts

/**
 * Adapter to transform River Financial CSV exports into our canonical Transaction objects.
 *
 * Expected CSV headers:
 * - Date                 (e.g. "2025-01-01 11:48:31")
 * - Sent Amount          (numeric, positive or negative)
 * - Sent Currency        ("USD" or "BTC")
 * - Received Amount      (numeric)
 * - Received Currency    ("USD" or "BTC")
 * - Fee Amount           (numeric)
 * - Fee Currency         ("USD")
 * - Tag                  ("Buy" | "Sell" | "Interest")
 */

// Type definition for the structure returned by this adapter
// Matching the expected structure in TransactionImporter
interface ProcessedImport {
  data?: Partial<any>; // Use Partial<Transaction> if type is available
  error?: string;
  skipped?: boolean;
  reason?: string;
  needsReview?: boolean;
  needsPrice?: boolean;
  sourceRow: Record<string, any>; 
}

// Keep the internal RiverTransaction type for clarity within the function
interface RiverTransactionInternal {
  timestamp: Date;
  type: 'buy' | 'sell' | 'receive';
  amount: number;
  asset: string;
  counterparty: 'River';
  fee: number;
  feeAsset: string;
  priceUsd?: number;
}

// Update function signature and return type
export function processRiverCsv(rows: Record<string, any>[]): ProcessedImport[] {
  const results: ProcessedImport[] = [];

  for (const row of rows) {
    try { // Wrap row processing in try/catch for individual errors
      const rawDate = row['Date'];
      const timestamp = new Date(rawDate);
      // Add validation for timestamp if needed
      if (isNaN(timestamp.getTime())) {
         throw new Error("Invalid date format");
      }

      // Use Number() for potentially safer parsing than parseFloat
      const sentAmt = Number(row['Sent Amount']);
      const sentCurrency = String(row['Sent Currency']);
      const recvAmt = Number(row['Received Amount']);
      const recvCurrency = String(row['Received Currency']);
      const feeAmt = Number(row['Fee Amount']);
      const feeCurrency = String(row['Fee Currency']);
      const tag = String(row['Tag']);

      // Validate required fields
      if (isNaN(sentAmt) || isNaN(recvAmt) || isNaN(feeAmt)) {
         throw new Error("Invalid numeric amount/fee");
      }

      let type: 'buy' | 'sell' | 'receive';
      let amount: number;
      let asset: string;
      let priceUsd: number | undefined;
      let transactionData: Partial<any> | undefined; // Use Partial<Transaction> later

      switch (tag) {
        case 'Buy':
          type = 'buy';
          amount = Math.abs(recvAmt);
          asset = recvCurrency;
          // Ensure division by zero doesn't happen
          priceUsd = (amount > 0) ? Math.abs(sentAmt) / amount : undefined;
          transactionData = { timestamp, type, amount, asset, price: priceUsd, priceAsset: 'USD', fee: feeAmt, feeAsset: feeCurrency, wallet: 'River' }; // Map to canonical structure
          break;

        case 'Sell':
          type = 'sell';
          amount = Math.abs(sentAmt);
          asset = sentCurrency;
          priceUsd = (amount > 0) ? Math.abs(recvAmt) / amount : undefined;
          transactionData = { timestamp, type, amount, asset, price: priceUsd, priceAsset: 'USD', fee: feeAmt, feeAsset: feeCurrency, wallet: 'River' };
          break;

        case 'Interest':
          type = 'receive'; // Or maybe a specific 'interest' type?
          amount = Math.abs(recvAmt);
          asset = recvCurrency;
          priceUsd = undefined; // Price doesn't apply to interest
          // Decide how to handle interest: skip or create a transaction?
          // Skipping for now, as it doesn't fit buy/sell model easily
          results.push({ sourceRow: row, skipped: true, reason: 'Interest payment' });
          continue; // Skip to next row
          // If importing interest: 
          // transactionData = { timestamp, type: 'deposit', // Assuming a deposit type exists
          //                   amount, asset, notes: 'Interest payment', wallet: 'River' }; 
          // break;

        default:
          // Skip unknown tags
          results.push({ sourceRow: row, skipped: true, reason: `Unknown tag: ${tag}` });
          continue; // Skip to next row
      }
      
      // Add successful transaction to results
      results.push({ sourceRow: row, data: transactionData });

    } catch (error) {
      // Handle errors for specific rows
      results.push({ 
         sourceRow: row, 
         error: error instanceof Error ? error.message : "Unknown processing error",
         skipped: true // Mark as skipped due to error
      });
    }
  }

  return results;
} 
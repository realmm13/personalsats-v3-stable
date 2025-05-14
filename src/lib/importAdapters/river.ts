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

// Canonical raw and parsed interfaces
export interface RawImportRecord { id: string; payload: string; /* ... */ }
export interface ParsedTransaction {
  id?: string;
  amount: number;
  date: Date;
  description?: string;
  timestamp?: Date;
  type?: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'interest';
  asset?: string;
  price?: number;
  priceAsset?: string;
  fee?: number;
  feeAsset?: string;
  wallet?: string;
  notes?: string;
  exchangeTxId?: string;
  tags?: string[];
}

// Type definition for the structure returned by this adapter
// Matching the expected structure in TransactionImporter
interface ProcessedImport {
  data?: Partial<ParsedTransaction>;
  error?: string;
  skipped?: boolean;
  reason?: string;
  needsReview?: boolean;
  needsPrice?: boolean;
  sourceRow: Record<string, unknown>;
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
export function processRiverCsv(rows: Record<string, unknown>[]): ProcessedImport[] {
  const results: ProcessedImport[] = [];

  for (const row of rows) {
    try { // Wrap row processing in try/catch for individual errors
      let rawDate = row.Date as string;
      let timestamp: Date | null = null;
      if (!rawDate) {
        throw new Error("Missing date");
      }
      // If the date is in 'YYYY-MM-DD HH:mm:ss' (no T, no Z), treat as UTC
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate)) {
        rawDate = rawDate.replace(' ', 'T') + 'Z';
      }
      timestamp = new Date(rawDate);
      if (isNaN(timestamp.getTime())) {
        throw new Error("Invalid date format");
      }

      // Use Number() for parsing, default NaN to 0 for checks
      const sentAmt = Number(row['Sent Amount'] ?? 0);
      const sentCurrency = String(row['Sent Currency'] ?? '');
      const recvAmt = Number(row['Received Amount'] ?? 0);
      const recvCurrency = String(row['Received Currency'] ?? '');
      const feeAmt = Number(row['Fee Amount'] ?? 0);
      const feeCurrency = String(row['Fee Currency'] ?? '');
      const tag = String(row['Tag'] ?? '').trim();
      console.log('[River Adapter] Row Tag:', tag, row);

      // Validate required amounts (at least one amount should be non-zero usually)
      // if (isNaN(sentAmt) || isNaN(recvAmt) || isNaN(feeAmt)) {
      //    throw new Error("Invalid numeric amount/fee");
      // }

      let transactionData: Partial<ParsedTransaction> | undefined = undefined; // Use Partial<Transaction>
      let skipReason: string | undefined = undefined;

      if (tag === 'Buy') {
          if (recvCurrency !== 'BTC' || sentCurrency !== 'USD' || recvAmt <= 0) {
             throw new Error("Invalid data for Buy tag");
          }
          const amount = recvAmt;
          const priceUsd = sentAmt / amount;
          transactionData = { 
            timestamp, type: 'buy', amount, asset: 'BTC', 
            price: priceUsd, priceAsset: 'USD', 
            fee: feeAmt > 0 ? feeAmt : undefined, feeAsset: feeAmt > 0 ? feeCurrency : undefined, 
            wallet: 'River' 
          };
      } else if (tag === 'Sell') {
          if (sentCurrency !== 'BTC' || recvCurrency !== 'USD' || sentAmt <= 0) {
             throw new Error("Invalid data for Sell tag");
          }
          const amount = sentAmt;
          const priceUsd = recvAmt / amount;
          transactionData = { 
            timestamp, type: 'sell', amount, asset: 'BTC', 
            price: priceUsd, priceAsset: 'USD', 
            fee: feeAmt > 0 ? feeAmt : undefined, feeAsset: feeAmt > 0 ? feeCurrency : undefined, 
            wallet: 'River' 
          };
      } else if (tag === 'Interest') {
        if (recvAmt <= 0 || !recvCurrency) {
          throw new Error("Invalid data for Interest tag");
        }
        transactionData = {
          timestamp, type: 'interest', // Use new type for interest
          amount: recvAmt, asset: recvCurrency,
          notes: 'Interest payment',
          wallet: 'River',
          price: undefined, priceAsset: undefined,
          fee: undefined, feeAsset: undefined,
          tags: ['Interest']
        };
        results.push({ sourceRow: row, data: transactionData });
        continue;
      } else if (recvAmt > 0 && sentAmt === 0 && recvCurrency === 'BTC') {
        // BTC deposit from cold storage/other exchange
        transactionData = {
          timestamp, type: 'deposit',
          amount: recvAmt, asset: recvCurrency,
          wallet: 'River',
          notes: 'Deposit (River)',
          price: undefined, priceAsset: undefined,
          fee: feeAmt > 0 ? feeAmt : undefined, feeAsset: feeAmt > 0 ? feeCurrency : undefined,
          tags: []
        };
        results.push({ sourceRow: row, data: transactionData });
        continue;
      } else {
          // Handle potential Deposits/Withdrawals based on amount columns if tag is unknown/empty
          if (recvAmt > 0 && sentAmt === 0) { // DEPOSIT pattern
              if (!recvCurrency) throw new Error("Missing Received Currency for Deposit");
              transactionData = { 
                timestamp, type: 'deposit',
                amount: recvAmt, asset: recvCurrency, 
                wallet: 'River', notes: 'Deposit (River)',
                // Price/Fee likely not applicable 
                price: undefined, priceAsset: undefined,
                fee: feeAmt > 0 ? feeAmt : undefined, feeAsset: feeAmt > 0 ? feeCurrency : undefined // Include fee if present
              };
          } else if (sentAmt > 0 && recvAmt === 0) { // WITHDRAWAL pattern
              if (!sentCurrency) throw new Error("Missing Sent Currency for Withdrawal");
              transactionData = { 
                timestamp, type: 'withdrawal', 
                amount: sentAmt, asset: sentCurrency, 
                wallet: 'River', notes: 'Withdrawal (River)',
                 // Price likely not applicable 
                price: undefined, priceAsset: undefined,
                fee: feeAmt > 0 ? feeAmt : undefined, feeAsset: feeAmt > 0 ? feeCurrency : undefined // Include fee if present
              };
          } else {
              // If it doesn't match Buy/Sell/Interest or Deposit/Withdrawal patterns, skip it
              skipReason = `Skipping row: Unhandled tag '${tag}' or ambiguous amounts (Sent: ${sentAmt}, Received: ${recvAmt})`;
          }
      }
      
      let tags: string[] = [];
      if (tag === 'Interest') {
        tags = ['Interest'];
      } else if (tag) {
        tags = [tag];
      }

      // Add successful transaction or skipped row to results
      if (transactionData) {
        transactionData.tags = tags;
        results.push({ sourceRow: row, data: transactionData });
      } else {
          results.push({ sourceRow: row, skipped: true, reason: skipReason ?? "Row did not match known patterns" });
      }

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
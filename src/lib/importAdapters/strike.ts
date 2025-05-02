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
interface ProcessedImport {
  data?: Partial<Transaction>; // Use Partial as not all fields might be derived
  error?: string;
  skipped?: boolean;
  reason?: string; // Add reason field
  needsReview?: boolean;
  needsPrice?: boolean; // Flag if price needs backfill
  sourceRow: Record<string, any>; // Use Record for standardization
}

// Import the shared ProcessedImport type if defined elsewhere, or define locally
// Assuming it's defined in TransactionImporter for now, adjust if needed
// import { ProcessedImport } from '@/components/import/TransactionImporter'; 
interface ProcessedImport {
  data?: Partial<Transaction>; // Use Partial<Transaction> if type is available
  error?: string;
  skipped?: boolean;
  reason?: string;
  needsReview?: boolean;
  needsPrice?: boolean;
  sourceRow: Record<string, any>; 
}

// Helper to parse Strike's date/time format
function parseStrikeTimestamp(dateStr: string, timeStr: string): Date | null {
    if (!dateStr || !timeStr) return null;
    try {
        // Corrected parsing assumption for Strike format
        const dateTimeString = `${dateStr} ${timeStr}Z`; // Assuming Z indicates UTC
        const parsed = parseISO(dateTimeString);
        if (isNaN(parsed.getTime())) throw new Error('Invalid date object from parseISO');
        return parsed;
    } catch (e) {
        console.error(`Failed to parse Strike timestamp: ${dateStr} ${timeStr}`, e);
        return null;
    }
}

function validateRequiredFields(row: StrikeRawRow): { isValid: boolean; error?: string } {
    const required = ['Transaction ID', 'Transaction Type', 'State', 'Completed Date (UTC)', 'Completed Time (UTC)'];
    for (const field of required) {
        if (row[field as keyof StrikeRawRow] === null || row[field as keyof StrikeRawRow] === undefined || row[field as keyof StrikeRawRow] === '') {
            return { isValid: false, error: `Missing required field: ${field}` };
        }
    }
    return { isValid: true };
}

function parseAmount(currency: string | null, value: number | null): { value: number; currency: string } {
    if (currency && typeof value === 'number') {
        return { value: Math.abs(value), currency };
    }
    // Return defaults or throw error if invalid
    return { value: 0, currency: '' }; // Or throw?
}

function parseFee(currency: string | null, value: number | null): { value: number | undefined; currency: string | undefined } {
    if (currency && typeof value === 'number' && value !== 0) {
        return { value: Math.abs(value), currency };
    }
    return { value: undefined, currency: undefined };
}

function parsePrice(currency: string | null, value: number | null): { value: number | undefined; currency: string | undefined } {
    if (currency === 'USD' && typeof value === 'number' && value > 0) { // Assuming price is always USD
        return { value: value, currency };
    }
    return { value: undefined, currency: undefined };
}

export function processStrikeCsv(rows: Record<string, any>[]): ProcessedImport[] {
  const results: ProcessedImport[] = [];
  const tradesById: Record<string, StrikeRawRow[]> = {};

  // --- Phase 1: Filter, Group Trades, Process Other Types --- 
  for (const row of rows as StrikeRawRow[]) { // Cast rows for easier access
    try {
        const validation = validateRequiredFields(row);
        if (!validation.isValid) {
            results.push({ sourceRow: row, error: validation.error, skipped: true, reason: validation.error });
            continue;
        }

        // Filter by State - Common check for all types we might process
        if (row.State !== 'Completed') {
            results.push({ sourceRow: row, skipped: true, reason: `State is ${row.State}, not Completed` });
            continue;
        }
        
        const transactionType = row['Transaction Type'];

        // --- Handle different transaction types --- 

        if (transactionType === 'Trade') {
            // Group Trade rows for later processing
            const txId = row['Transaction ID'];
            if (!tradesById[txId]) {
                tradesById[txId] = [];
            }
            tradesById[txId].push(row);
        
        } else if (transactionType === 'Deposit' || transactionType === 'Withdrawal') {
            // Explicitly skip Deposit/Withdrawal types as requested
            results.push({ sourceRow: row, skipped: true, reason: `Skipping type: ${transactionType}` });
            continue;
        
        } else if (transactionType === 'Onchain') {
            // Process Onchain transactions
            const timestamp = parseStrikeTimestamp(row['Completed Date (UTC)'], row['Completed Time (UTC)']);
            if (!timestamp) {
                results.push({ sourceRow: row, error: "Invalid completion timestamp for Onchain tx", skipped: true });
                continue;
            }

            const amount2 = row['Amount 2'];
            const currency2 = row['Currency 2'];

            if (currency2 !== 'BTC' || typeof amount2 !== 'number' || amount2 === 0) {
                results.push({ sourceRow: row, skipped: true, reason: `Onchain tx skipped: Invalid BTC amount/currency (Amount: ${amount2}, Currency: ${currency2})` });
                continue;
            }

            const type: 'deposit' | 'withdrawal' = amount2 > 0 ? 'deposit' : 'withdrawal';
            const amount = Math.abs(amount2);
            const asset = 'BTC'; // Asset is BTC for Onchain

            // Attempt to parse fee (usually from Amount/Currency 1 for Onchain sends)
            const feeCurrency = row['Currency 1']; // Check Currency 1 for fee
            const feeValue = row['Fee 1'] ?? row['Amount 1']; // Fee might be in Fee 1 or reflected in Amount 1
            const fee = parseFee(feeCurrency, typeof feeValue === 'number' ? feeValue : null);

            results.push({
                sourceRow: row,
                data: {
                    timestamp,
                    type: type,
                    amount,
                    asset,
                    fee: fee.value,
                    feeAsset: fee.currency, 
                    wallet: 'Strike',
                    notes: 'Onchain Transfer', // Add a note
                    exchangeTxId: row['Transaction ID'],
                    // Price is not applicable for direct BTC transfers
                    price: undefined,
                    priceAsset: undefined,
                }
            });
        
        } else {
            // Skip other types like Lightning, P2P, etc.
            results.push({ sourceRow: row, skipped: true, reason: `Skipping type: ${transactionType}` });
            continue;
        }

    } catch (error) {
        results.push({ sourceRow: row, error: error instanceof Error ? error.message : "Unknown row processing error", skipped: true });
    }
  }

  // --- Phase 2: Process Aggregated Trades --- 
  for (const txId in tradesById) {
    const tradeRows = tradesById[txId];
    if (!tradeRows) continue;
    const firstRow = tradeRows[0]; // Use first row for context/errors
    try {
        if (!tradeRows || tradeRows.length === 0 || !firstRow) continue;

        let sumUsd = 0;
        let sumBtc = 0;
        let sumFeeUsd = 0; // Assuming fees are in USD (Fee 1)
        let earliestTimestamp: Date | null = null;

        for (const row of tradeRows) {
            const timestamp = parseStrikeTimestamp(row['Completed Date (UTC)'], row['Completed Time (UTC)']);
            if (timestamp && (!earliestTimestamp || timestamp < earliestTimestamp)) {
                earliestTimestamp = timestamp;
            }
            
            // Aggregate amounts based on currency
            if (row['Currency 1'] === 'USD') sumUsd += row['Amount 1'] ?? 0;
            if (row['Currency 2'] === 'USD') sumUsd += row['Amount 2'] ?? 0;
            if (row['Currency 1'] === 'BTC') sumBtc += row['Amount 1'] ?? 0;
            if (row['Currency 2'] === 'BTC') sumBtc += row['Amount 2'] ?? 0;
            if (row['Fee 1']) sumFeeUsd += row['Fee 1'] ?? 0; // Aggregate Fee 1 only (assuming USD)
        }

        if (!earliestTimestamp) {
            throw new Error('Could not determine timestamp for trade');
        }

        let tradeType: 'buy' | 'sell' | undefined = undefined;
        if (sumUsd < 0 && sumBtc > 0) tradeType = 'buy';
        else if (sumUsd > 0 && sumBtc < 0) tradeType = 'sell';
        
        const absBtc = Math.abs(sumBtc);
        const absUsd = Math.abs(sumUsd);

        if (!tradeType || absBtc === 0) {
            throw new Error('Could not determine trade type or zero BTC amount');
        }
        
        const price = absUsd / absBtc; // Effective price (VWAP)
        const fee = Math.abs(sumFeeUsd);

        results.push({
            sourceRow: firstRow, // Use first row as representative source
            data: {
                exchangeTxId: txId,
                timestamp: earliestTimestamp,
                type: tradeType,
                amount: absBtc,
                asset: 'BTC',
                price: price,
                priceAsset: 'USD',
                fee: fee > 0 ? fee : undefined,
                feeAsset: fee > 0 ? 'USD' : undefined, // Assume fee was USD
                wallet: 'Strike',
            },
        });
    } catch (error) {
        // Add error specific to this trade aggregation
        results.push({ 
            sourceRow: firstRow || {}, 
            error: `Trade ${txId}: ${error instanceof Error ? error.message : "Unknown aggregation error"}`,
            skipped: true 
        });
    }
  }

  console.log(`Strike Adapter: Processed ${rows.length} raw rows into ${results.filter(r => r.data).length} canonical records, ${results.filter(r => r.skipped).length} skipped.`);
  return results;
} 
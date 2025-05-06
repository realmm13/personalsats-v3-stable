import { parseISO } from 'date-fns';
import type { Transaction } from '@/lib/types'; // Import canonical type

// Define the expected raw row structure from PapaParse (dynamicTyping=true)
interface StrikeRawRow {
  [key: string]: unknown;
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

export interface RawImportRecord { id: string; payload: string; /* ... */ }
export interface ParsedTransaction {
  id?: string;
  amount: number;
  date?: Date;
  description?: string;
  timestamp?: Date;
  type?: 'buy' | 'sell' | 'deposit' | 'withdrawal';
  asset?: string;
  price?: number;
  priceAsset?: string;
  fee?: number;
  feeAsset?: string;
  wallet?: string;
  notes?: string;
  exchangeTxId?: string;
}

interface ProcessedImport {
  data?: Partial<ParsedTransaction>;
  error?: string;
  skipped?: boolean;
  reason?: string;
  needsReview?: boolean;
  needsPrice?: boolean;
  sourceRow: Record<string, unknown>;
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

export function processStrikeCsv(rows: Record<string, unknown>[]): ProcessedImport[] {
  const results: ProcessedImport[] = [];
  const tradesById: Record<string, StrikeRawRow[]> = {};

  // --- Phase 1: Filter, Group Trades, Process Other Types --- 
  for (const row of rows as StrikeRawRow[]) {
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
        
        const transactionType = row['Transaction Type']?.toLowerCase(); // Use lowercase for matching
        const txId = row['Transaction ID']; // Get Tx ID for notes/reference

        // --- Handle different transaction types --- 

        if (transactionType === 'trade') {
            // Group Trade rows
            if (!tradesById[txId]) tradesById[txId] = [];
            tradesById[txId].push(row);
        
        } else if (transactionType === 'deposit' || transactionType === 'withdrawal') {
            // Explicitly skip Strike's own Deposit/Withdrawal types
                results.push({ sourceRow: row, skipped: true, reason: `Skipping type: ${row['Transaction Type']}` });
                continue;

        } else if (transactionType === 'onchain' || transactionType === 'p2p' || transactionType === 'lightning') {
            // Process Onchain, P2P, Lightning
            const timestamp = parseStrikeTimestamp(row['Completed Date (UTC)'], row['Completed Time (UTC)']);
            if (!timestamp) {
                results.push({ sourceRow: row, error: `Invalid completion timestamp for ${transactionType} tx`, skipped: true });
                continue;
            }

            // Amount 2 determines direction and amount for these types
            const amount2 = row['Amount 2'];
            const currency2 = row['Currency 2'];

            // These types must involve BTC in Amount 2
            if (currency2 !== 'BTC' || typeof amount2 !== 'number' || amount2 === 0) {
                results.push({ sourceRow: row, skipped: true, reason: `${transactionType} tx skipped: Invalid BTC amount/currency in Amount 2 (Amount: ${amount2}, Currency: ${currency2})` });
                continue;
            }

            const type: 'deposit' | 'withdrawal' = amount2 > 0 ? 'deposit' : 'withdrawal';
            const amount = Math.abs(amount2);
            const asset = 'BTC'; 

            let fee: number | undefined = undefined;
            let feeAsset: string | undefined = undefined;
            let notes = `${transactionType.charAt(0).toUpperCase() + transactionType.slice(1)} Transfer`; // Default notes

            if (transactionType === 'lightning') {
                // Lightning fees are in Fee 2 (BTC)
                const fee2Value = row['Fee 2'];
                if (typeof fee2Value === 'number' && fee2Value !== 0) {
                    fee = Math.abs(fee2Value);
                    feeAsset = 'BTC';
                }
                notes = 'Lightning Transfer';
            } else if (transactionType === 'onchain') {
                 // Onchain fees might be in Fee 1 or Amount 1 (often USD cost for the fee)
                 const feeCurrency = row['Currency 1'];
                 const feeValue = row['Fee 1'] ?? row['Amount 1'];
                 const parsedFee = parseFee(feeCurrency, typeof feeValue === 'number' ? feeValue : null);
                 fee = parsedFee.value;
                 feeAsset = parsedFee.currency;
                 notes = 'Onchain Transfer';
            } else if (transactionType === 'p2p') {
                // Assume no direct fee for P2P unless specified otherwise
                notes = 'P2P Transfer';
            }

            results.push({
                sourceRow: row,
                data: {
                    timestamp,
                    type: type,
                    amount,
                    asset,
                    fee: fee, // Use parsed fee
                    feeAsset: feeAsset, // Use parsed fee asset
                    wallet: 'Strike',
                    notes: notes,
                    exchangeTxId: txId,
                    price: undefined, // Price not applicable
                    priceAsset: undefined,
                }
            });
        
        } else {
            // Skip any other types not explicitly handled
            results.push({ sourceRow: row, skipped: true, reason: `Skipping unhandled type: ${row['Transaction Type']}` });
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
import { db } from "@/lib/db";
import { differenceInDays } from 'date-fns';
import type { Lot, Allocation, BitcoinTransaction } from "@prisma/client";
import { type CostBasisMethod, selectLotsForSale, type SaleResult, type AvailableLot } from "@/lib/cost-basis"; // Import necessary types

// Define the structure for the dynamically generated report
export interface TaxReport {
  year: number;
  method: CostBasisMethod;
  totalRealizedGain: number;
  realizedGainST: number;
  realizedGainLT: number;
  totalUnrealizedGain: number;
  details: Array<{
    saleTxId: string;        // Transaction ID of the sale
    saleDate: Date;          // Date of the sale transaction
    asset: string;           // e.g., "BTC"
    amountSold: number;      // Total amount sold in the transaction
    proceeds: number;        // Total proceeds from the sale transaction
    costBasis: number;       // Total cost basis calculated for this sale using the method
    gain: number;             // Total realized gain/loss for this sale transaction
    term: 'Short' | 'Long' | 'Mixed'; // Overall term for the sale transaction gains
    // Optionally add breakdown of lots contributing to each sale detail
    contributingLots: Array<{
      lotTxId: string;
      lotOpenedAt: Date;
      qtyUsed: number;
      costBasisPerUnit: number;
      gain: number;
      term: 'Short' | 'Long';
    }>;
  }>;
}

/**
 * Generates a tax report dynamically for a given user, year, and accounting method.
 * 
 * @param userId The ID of the user.
 * @param year The tax year for the report.
 * @param method The cost basis accounting method (FIFO, LIFO, HIFO).
 * @param currentPrice The current price of the asset (e.g., BTC) in USD for unrealized gain calculation.
 * @returns A promise that resolves to the TaxReport object.
 */
export async function generateTaxReport(
  userId: string, 
  year: number, 
  method: CostBasisMethod, 
  currentPrice: number
): Promise<TaxReport> {

  if (currentPrice < 0) {
    throw new Error("Current price cannot be negative.");
  }

  // 1. Fetch all transactions for the user up to the end of the target year
  const endDate = new Date(year + 1, 0, 1); // Start of the next year
  const transactions = await db.bitcoinTransaction.findMany({
    where: {
      userId: userId,
      timestamp: { lt: endDate }, // Get all tx up to the end of the year
    },
    orderBy: { timestamp: 'asc' }, // Crucial to process in chronological order
  });

  // Initialize report structure
  const report: TaxReport = {
    year: year,
    method: method,
    totalRealizedGain: 0,
    realizedGainST: 0,
    realizedGainLT: 0,
    totalUnrealizedGain: 0,
    details: [],
  };

  // 2. Simulate lot inventory and process sales
  const currentLots: AvailableLot[] = [];
  const lotCounter = 0; // Simple counter for temporary lot IDs during simulation

  for (const tx of transactions) {
    if (tx.type === 'buy' && tx.amount && tx.price) {
      // Add new lot to inventory
      currentLots.push({
        id: tx.id, // Use actual transaction ID as lot ID
        date: tx.timestamp.getTime(),
        originalAmount: tx.amount,
        remaining: tx.amount,
        price: tx.price, // Cost basis per unit for this lot
      });
    } else if (tx.type === 'sell' && tx.amount && tx.price) {
      // Process SELL transaction
      const saleYear = tx.timestamp.getFullYear();
      const saleAmount = tx.amount;
      const salePrice = tx.price;
      const saleDateMs = tx.timestamp.getTime();

      let saleResult: SaleResult | undefined;
      try {
         const lotsForSale = currentLots.map(l => ({...l})); 
         saleResult = selectLotsForSale(
            lotsForSale, 
            saleAmount,
            method,
            salePrice,
            saleDateMs
         );
      } catch (e) {
         console.error(`Error selecting lots for sale ${tx.id} during report generation:`, e instanceof Error ? e.message : e);
         // Throwing here will stop the report generation. Alternatively, continue 
         // but add a note to the report about this failed transaction.
         // For now, let's re-throw to make it clear the report might be incomplete.
         throw new Error(`Failed to select lots for sale transaction ${tx.id}: ${e instanceof Error ? e.message : e}`);
      }
      
      // Only proceed if saleResult is valid and has lots
      if (saleResult && saleResult.selectedLots && saleResult.selectedLots.length > 0) {
        // Update remaining quantities in our main `currentLots` based on the selection
        for (const selected of saleResult.selectedLots) {
           const lotIndex = currentLots.findIndex(l => l.id === selected.id);
           if (lotIndex !== -1) {
               // @ts-ignore: remaining is guaranteed non-null by SelectedLot interface
               currentLots[lotIndex].remaining = selected.remaining!;
           }
        }
         // Remove fully depleted lots from main inventory
         // @ts-ignore: remaining is guaranteed non-null by SelectedLot/AvailableLot interfaces
         const depletedLotIds = saleResult.selectedLots.filter(l => l.remaining <= 1e-8).map(l => l.id);
         for (let i = currentLots.length - 1; i >= 0; i--) {
              // @ts-ignore: remaining is guaranteed non-null by AvailableLot interface
              if (depletedLotIds.includes(currentLots[i].id) && currentLots[i].remaining <= 1e-8) {
                  currentLots.splice(i, 1);
              }
          }
        
        // --- Aggregate gains ONLY if the sale happened within the reporting year ---
        if (saleYear === year) {
            let saleGainST = 0;
            let saleGainLT = 0;
            let totalSaleCostBasis = 0;
            let totalSaleProceeds = 0;
            const contributingLots: TaxReport['details'][0]['contributingLots'] = [];

            for(const selected of saleResult.selectedLots) {
                // Use non-null assertions (!) to assure TS these are defined,
                // based on the guarantee from selectLotsForSale and SelectedLot interface.
               const costBasis = selected.costBasis;
               const proceeds = selected.proceeds;
               const gain = selected.realizedGain;
               const amountUsed = selected.amountUsed;
               const isLongTerm = selected.isLongTerm;
               const purchaseDate = selected.purchaseDate;
               
               totalSaleCostBasis += costBasis;
               totalSaleProceeds += proceeds;

               const costBasisPerUnit = amountUsed > 0 ? (costBasis / amountUsed) : 0;

               contributingLots.push({
                  lotTxId: selected.id,
                  lotOpenedAt: new Date(purchaseDate),
                  qtyUsed: amountUsed,
                  costBasisPerUnit: costBasisPerUnit, 
                  gain: gain,
                  term: isLongTerm ? 'Long' : 'Short'
               });

               if (isLongTerm) {
                   saleGainLT += gain;
               } else {
                   saleGainST += gain;
               }
            }

            const totalSaleGain = saleGainST + saleGainLT;
            report.realizedGainST += saleGainST;
            report.realizedGainLT += saleGainLT;
            report.totalRealizedGain += totalSaleGain;

            let overallTerm: 'Short' | 'Long' | 'Mixed' = 'Short';
            if (saleGainST > 0 && saleGainLT > 0) {
                overallTerm = 'Mixed';
            } else if (saleGainLT > 0) {
                overallTerm = 'Long';
            }
            
            report.details.push({
              saleTxId: tx.id,
              saleDate: tx.timestamp,
              asset: "BTC", 
              amountSold: saleAmount,
              proceeds: totalSaleProceeds,
              costBasis: totalSaleCostBasis,
              gain: totalSaleGain,
              term: overallTerm,
              contributingLots: contributingLots,
            });
        }
      } else if (saleResult && (!saleResult.selectedLots || saleResult.selectedLots.length === 0)) {
          // Handle case where selectLotsForSale succeeded but returned no lots (shouldn't happen if it throws error)
          console.warn(`Sale transaction ${tx.id} resulted in zero selected lots.`);
      }
    }
  }

  // 3. Calculate Unrealized Gains from lots remaining at the end of the year
  for (const lot of currentLots) {
    if (lot.remaining > 1e-8 && lot.originalAmount > 0) { // Use small threshold for float remaining
      const costBasisPerUnit = lot.price;
      const unrealizedGainPerUnit = currentPrice - costBasisPerUnit;
      const unrealizedGainForLot = unrealizedGainPerUnit * lot.remaining;
      report.totalUnrealizedGain += unrealizedGainForLot;
    }
  }

  // 4. Return the completed report
  return report;
} 
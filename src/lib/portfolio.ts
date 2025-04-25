import type { Transaction } from "@/lib/types";

interface Lot {
  id: string;
  amount: number;
  remaining: number;
  price: number;
}

interface PortfolioSummary {
  totalBTC: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnL?: number;
  percentageReturn?: number;
}

export function calculatePortfolioSummary(transactions: Transaction[] = [], currentPrice: number | null): PortfolioSummary {
  // Explicitly check if transactions is an array
  if (!Array.isArray(transactions)) {
    console.error("calculatePortfolioSummary received non-array:", transactions);
    // Return a default summary if it's not an array somehow
    return {
      totalBTC: 0,
      costBasis: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      percentageReturn: 0
    };
  }

  // Now it's safe to spread
  const sortedTransactions = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  // Track lots for cost basis
  let lots: Lot[] = [];
  let lotCounter = 1;
  
  // Process transactions to track remaining lots
  for (const tx of sortedTransactions) {
    if (tx.type === 'buy') {
      lots.push({
        id: `LOT-${lotCounter++}`,
        amount: tx.amount,
        remaining: tx.amount,
        price: tx.price
      });
    } else if (tx.type === 'sell') {
      // Use FIFO to reduce lots
      let remainingToSell = tx.amount;
      for (const lot of lots) {
        if (remainingToSell <= 0) break;
        
        const amountFromLot = Math.min(lot.remaining, remainingToSell);
        lot.remaining -= amountFromLot;
        remainingToSell -= amountFromLot;
      }
      // Remove fully used lots
      lots = lots.filter(lot => lot.remaining > 0);
    }
  }

  // Calculate totals from remaining lots
  const summary = lots.reduce((acc, lot) => ({
    totalBTC: acc.totalBTC + lot.remaining,
    costBasis: acc.costBasis + (lot.remaining * lot.price)
  }), {
    totalBTC: 0,
    costBasis: 0
  });

  const currentValue = currentPrice ? summary.totalBTC * currentPrice : 0;
  const unrealizedPnL = currentValue - summary.costBasis;
  const percentageReturn = summary.costBasis > 0 ? (unrealizedPnL / summary.costBasis) * 100 : 0;

  return {
    ...summary,
    currentValue,
    unrealizedPnL,
    percentageReturn
  };
}

export function getRecentTransactions(transactions: Transaction[] = [], limit = 3): Transaction[] {
  return [...transactions]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

// Helper function to calculate realized gains/losses
export function calculateRealizedGains(transactions: Transaction[] = []): number {
  const sortedTransactions = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let lots: Lot[] = [];
  let lotCounter = 1;
  let realizedGains = 0;

  for (const tx of sortedTransactions) {
    if (tx.type === 'buy') {
      lots.push({
        id: `LOT-${lotCounter++}`,
        amount: tx.amount,
        remaining: tx.amount,
        price: tx.price
      });
    } else if (tx.type === 'sell') {
      let remainingToSell = tx.amount;
      for (const lot of lots) {
        if (remainingToSell <= 0) break;
        
        const amountFromLot = Math.min(lot.remaining, remainingToSell);
        realizedGains += amountFromLot * (tx.price - lot.price);
        lot.remaining -= amountFromLot;
        remainingToSell -= amountFromLot;
      }
      lots = lots.filter(lot => lot.remaining > 0);
    }
  }

  return realizedGains;
} 
interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: number;
}

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

export function calculatePortfolioSummary(transactions: Transaction[], currentPrice: number | null): PortfolioSummary {
  if (!transactions?.length) {
    return {
      totalBTC: 0,
      costBasis: 0,
      currentValue: 0,
      unrealizedPnL: 0,
      percentageReturn: 0
    };
  }

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
  
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

export function getRecentTransactions(transactions: Transaction[], limit = 3): Transaction[] {
  return [...transactions]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// Helper function to calculate realized gains/losses
export function calculateRealizedGains(transactions: Transaction[]): number {
  const sortedTransactions = [...transactions].sort((a, b) => a.timestamp - b.timestamp);
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
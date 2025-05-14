export enum CostBasisMethod {
  HIFO = 'HIFO',
}

export interface AvailableLot {
  id: string;
  date: number;           // timestamp of purchase in ms
  originalAmount: number; // total BTC purchased in this lot
  remaining: number;      // amount still available
  price: number;          // cost basis per unit (USD)
}

export interface SelectedLot {
  id: string;
  amountUsed: number;
  costBasis: number;
  proceeds: number;
  realizedGain: number;
  isLongTerm: boolean;
  purchaseDate: number;
  remaining: number;
}

export interface SaleResult {
  saleId?: string;
  selectedLots: SelectedLot[];
  totalCostBasis: number;
  totalProceeds: number;
  totalRealizedGain: number;
  isAllLongTerm: boolean;
  error?: string;
}

export function selectLotsForSale(
  availableLots: AvailableLot[],
  saleAmount: number,
  method: CostBasisMethod,
  salePrice: number,
  saleDateMs: number
): SaleResult {
  const lots = [...availableLots];
  // Always use HIFO
  lots.sort((a, b) => b.price - a.price);

  let remainingToSell = saleAmount;
  const selectedLots: SelectedLot[] = [];
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  for (const lot of lots) {
    if (remainingToSell <= 0) break;
    const qty = Math.min(lot.remaining, remainingToSell);
    if (qty <= 0) continue;
    
    const costBasis = qty * lot.price;
    const proceeds = qty * salePrice;
    const realizedGain = proceeds - costBasis;
    const isLongTerm = (saleDateMs - lot.date) > ONE_YEAR_MS;
    const remainingInLot = lot.remaining - qty;

    selectedLots.push({
      id: lot.id,
      amountUsed: qty,
      costBasis,
      proceeds,
      realizedGain,
      isLongTerm,
      purchaseDate: lot.date,
      remaining: remainingInLot,
    });

    lot.remaining = remainingInLot;

    remainingToSell -= qty;
  }

  if (remainingToSell > 1e-8) {
    return {
        error: `Insufficient available lots to sell ${saleAmount}. Remaining needed: ${remainingToSell.toFixed(8)}`,
        selectedLots: [],
        totalCostBasis: 0,
        totalProceeds: 0,
        totalRealizedGain: 0,
        isAllLongTerm: false,
    };
  }

  const totalCostBasis = selectedLots.reduce((sum, l) => sum + l.costBasis, 0);
  const totalProceeds  = selectedLots.reduce((sum, l) => sum + l.proceeds, 0);
  const totalRealizedGain = selectedLots.reduce((sum, l) => sum + l.realizedGain, 0);
  const isAllLongTerm = selectedLots.every(l => l.isLongTerm);

  return {
    selectedLots,
    totalCostBasis,
    totalProceeds,
    totalRealizedGain,
    isAllLongTerm,
  };
} 
export type TransactionType = 'buy' | 'sell';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
  timestamp: Date;
  userId: string;
  notes?: string;
}

export interface PortfolioSummary {
  totalBTC: number;
  costBasis: number;
  currentValue: number;
  unrealizedPnL: number;
  percentageReturn: number;
}

export interface PortfolioHistory {
  timestamp: Date;
  totalBTC: number;
  value: number;
  costBasis: number;
}

export interface Trade {
  id: string;
  type: TransactionType;
  amount: number;
  price: number;
  timestamp: Date;
  totalValue: number;
  userId: string;
  notes?: string;
} 
export type TransactionType = 'buy' | 'sell';

export interface Transaction {
  id: string;
  userId: string;
  timestamp: string | Date;
  type?: 'buy' | 'sell' | null;
  amount?: number | null;
  asset?: string;
  price?: number | null;
  priceAsset?: string;
  fee?: number | null;
  feeAsset?: string;
  wallet?: string | null;
  counterparty?: string | null;
  tags?: string[];
  notes?: string | null;
  exchangeTxId?: string | null;
  encryptedData?: string | null;
  decryptionError?: boolean;
  isDecrypted?: boolean;
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

export interface PortfolioSnapshot {
  date: string | Date;
  portfolioValue: number;
  costBasis: number;
} 
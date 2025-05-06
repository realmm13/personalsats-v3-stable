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
  encryptedData?: string; // Client-side encrypted blob
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: string;
  avatarImageUrl?: string;
  coverImageUrl?: string;
  onboarded: boolean;
  encryptionSalt?: string | null;
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

export interface TransactionPayload {
  id: string;
  encryptedData: string;
  amount: number;
  date: string;
  price?: number;
  fee?: number;
  wallet?: string;
  tags?: string[];
  notes?: string;
}

export interface BulkResult {
  id: string;
  status: 'ok' | 'error';
  message?: string;
} 
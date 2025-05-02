"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/components/DialogManager';
import useSWR from 'swr';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bitcoin,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Clock,
  Plus,
  BarChart3,
  Upload,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { formatUSD } from '@/lib/price';
import { calculatePortfolioSummary, getRecentTransactions } from '@/lib/portfolio';
import type { Transaction, PortfolioSummary } from '@/lib/types';
import { Spinner } from "@/components/Spinner";

import { AddTransactionForm } from '@/components/dashboard/AddTransactionForm';
import { TransactionImporter } from '@/components/import/TransactionImporter';
import { format } from 'date-fns';
import { useEncryption } from "@/context/EncryptionContext";
import { decryptString } from "@/lib/encryption";
import { PassphraseGuideModal } from "@/components/PassphraseGuideModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DashboardClient() {
  const { price: bitcoinPrice, lastUpdated, loading: priceLoading } = useBitcoinPrice();
  const router = useRouter();
  const { openDialog: openAddTransactionDialog } = useDialog();
  
  // --- Fetch All Transactions ---
  const apiUrl = "/api/transactions"; // Fetch all transactions
  const { data: rawTransactions, error: transactionsError, isLoading: transactionsLoading, mutate: mutateTransactions } = 
    useSWR<Transaction[]>(apiUrl, fetcher); 
  // ---------------------------
  
  // --- Log Raw Data ---
  console.log("[Raw API Data]:", rawTransactions);
  // --------------------

  const { 
    encryptionKey, 
    isLoadingKey, 
    isKeySet
  } = useEncryption();
  const [decryptedTransactions, setDecryptedTransactions] = useState<Transaction[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // useEffect for decryption
  useEffect(() => {
    // Removed log from here
    // console.log("[DashboardClient] Encryption Key Check (in useEffect):", encryptionKey);
    
    if (!rawTransactions || rawTransactions.length === 0 || !encryptionKey) {
      if (decryptedTransactions.length > 0) setDecryptedTransactions([]); 
      return;
    }

    const decryptAll = async () => {
      // Add log here, just before decryption loop starts
      console.log("--- [DashboardClient] Starting decryption loop. Key state: ---", encryptionKey); 
      
      console.log("Attempting to decrypt transactions..."); // Keep existing log
      
      const decryptedPromises = rawTransactions.map(async (tx) => {
        if (!tx.encryptedData) {
          return tx;
        }
        // Check encryptionKey again just before decrypting (should be same as above log)
        if (!encryptionKey) { 
             console.error(`❌ Cannot decrypt tx ${tx.id} because key became null unexpectedly.`);
             return { ...tx, timestamp: new Date(tx.timestamp), isDecrypted: false, decryptionError: true };
        }

        try {
          const decryptedString = await decryptString(tx.encryptedData, encryptionKey);
          const decryptedObject = JSON.parse(decryptedString);
          
          // --- Add Logging ---
          console.log(`[Decrypt Log] Tx ID: ${tx.id}`);
          console.log("[Decrypt Log] Original tx:", tx);
          console.log("[Decrypt Log] Decrypted object:", decryptedObject);
          // -------------------
          
          return {
            ...tx, // Original data (id, userId, timestamp, potentially null fields)
            ...decryptedObject, // Overwrite with decrypted fields
            timestamp: new Date(tx.timestamp), // Ensure timestamp is Date object
            isDecrypted: true,
            encryptedData: null, // Clear encrypted data field
          };
        } catch (error) {
          console.error(`❌ Failed to decrypt transaction ${tx.id}:`, error);
          return {
            ...tx,
            timestamp: new Date(tx.timestamp),
            isDecrypted: false,
          };
        }
      });

      const results = await Promise.all(decryptedPromises);
      console.log("Decryption complete.");
      setDecryptedTransactions(results);
    };

    decryptAll();
  }, [rawTransactions, encryptionKey]); // Dependencies: run when raw data or key changes

  if (transactionsLoading || priceLoading || (isLoadingKey && !encryptionKey && decryptedTransactions.length === 0) ) {
    // Adjusted loading state: Show spinner if loading data/price, OR if loading key AND we don't have decrypted data yet
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  if (transactionsError) {
    return <div className="text-center text-red-500">Failed to load transaction data.</div>;
  }

  // Use decryptedTransactions for calculations and display
  const portfolio = calculatePortfolioSummary(decryptedTransactions, bitcoinPrice);
  const recentTransactionsToDisplay = getRecentTransactions(decryptedTransactions);

  // --- Log State Before Render ---
  console.log("[State Check] decryptedTransactions:", decryptedTransactions);
  console.log("[State Check] recentTransactionsToDisplay:", recentTransactionsToDisplay);
  // -------------------------------

  const safePortfolio: PortfolioSummary = {
    totalBTC: portfolio.totalBTC ?? 0, // Add nullish coalescing for safety
    costBasis: portfolio.costBasis ?? 0,
    currentValue: portfolio.currentValue ?? 0,
    unrealizedPnL: portfolio.unrealizedPnL ?? 0,
    percentageReturn: portfolio.percentageReturn ?? 0
  };

  const handleAddTransaction = () => {
    openAddTransactionDialog({
      title: "Add Transaction",
      component: AddTransactionForm,
      props: {
        onSuccess: () => {
          mutateTransactions();
        },
      },
    });
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
  };

  const handleImportComplete = () => {
    setIsImportModalOpen(false);
    mutateTransactions();
  };

  const handleViewAllTransactions = () => {
    router.push('/transactions');
  };

  const shouldShowPercentage = (value: number) => value !== 0;

  return (
    <>
      <PassphraseGuideModal />
      <div className="vertical space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">
                Portfolio Value
              </h3>
              <Bitcoin className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{formatUSD(safePortfolio.currentValue)}</div>
              {shouldShowPercentage(safePortfolio.percentageReturn) && (
                <Badge 
                  variant="default"
                  color={safePortfolio.percentageReturn >= 0 ? "green" : "red"}
                >
                  {safePortfolio.percentageReturn >= 0 ? '+' : ''}{safePortfolio.percentageReturn.toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {bitcoinPrice ? `@ ${formatUSD(bitcoinPrice)}/BTC` : 'Loading price...'}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">
                Total Bitcoin
              </h3>
              <TrendingUp className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{safePortfolio.totalBTC.toFixed(8)}</div>
              <Badge variant="default" color="orange">BTC</Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Current Holdings
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">Cost Basis</h3>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{formatUSD(safePortfolio.costBasis)}</div>
            </div>
            <p className="text-muted-foreground text-xs">
              Total Investment
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between space-y-2">
              <h3 className="text-muted-foreground text-sm font-medium">
                Unrealized P&L
              </h3>
              <BarChart3 className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{formatUSD(safePortfolio.unrealizedPnL)}</div>
              {shouldShowPercentage(safePortfolio.percentageReturn) && (
                <Badge 
                  variant="default"
                  color={safePortfolio.unrealizedPnL >= 0 ? "green" : "red"}
                >
                  {safePortfolio.unrealizedPnL >= 0 ? '+' : ''}{safePortfolio.percentageReturn.toFixed(1)}%
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Unrealized Profit/Loss
            </p>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-7">
          <Card className="col-span-4 p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Transactions</h2>
              <Button variant="outline" size="sm" onClick={handleViewAllTransactions}>
                View All
              </Button>
            </div>
            <div className="space-y-4">
              {decryptedTransactions.length === 0 ? (
                <div className="text-muted-foreground text-center py-4">
                  {(!rawTransactions || rawTransactions.length === 0) ? "No transactions yet" : (isLoadingKey ? "Decrypting..." : "Enter passphrase to view details")}
                </div>
              ) : (
                recentTransactionsToDisplay.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-start gap-4 rounded-lg border p-3"
                  >
                    <div className="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
                      {tx.type === 'buy' ? (
                        <ArrowUpRight className="text-primary h-5 w-5" />
                      ) : (
                        <Clock className="text-primary h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div>
                        <div className="font-medium">
                          {tx.type === 'buy' ? 'Bought' : 'Sold'} {typeof tx.amount === "number" ? tx.amount.toFixed(8) : (tx.decryptionError ? "Decrypt Failed" : "...")} BTC
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.timestamp ? format(new Date(tx.timestamp), 'MMM d, yyyy, h:mm a') : (tx.decryptionError ? "-" : "...")}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Wallet: {tx.wallet ?? (tx.decryptionError ? "-" : "...")}
                      </p>
                      {(tx.tags && tx.tags.length > 0) ? (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {tx.tags.map((tag) => (
                            <Badge key={tag} variant="outline" color="gray" size="sm">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                         !tx.decryptionError && <div className="text-xs text-muted-foreground italic">No Tags</div>
                      )}
                      {tx.decryptionError && (
                        <p className="text-xs text-red-500">Decryption Failed</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {typeof tx.amount === 'number' && typeof tx.price === 'number' ? formatUSD(tx.amount * tx.price) : (tx.decryptionError ? "-" : "...")}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        @ {typeof tx.price === 'number' ? formatUSD(tx.price) : (tx.decryptionError ? "-" : "...")}/BTC
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Fee: {typeof tx.fee === 'number' ? formatUSD(tx.fee) : (tx.decryptionError ? "-" : "...")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="col-span-3 p-6">
            <h2 className="mb-6 text-xl font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Button className="h-auto flex-col items-start justify-start p-4" variant="outline" onClick={handleAddTransaction}>
                <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-full">
                  <Plus className="text-primary h-5 w-5" />
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm leading-none font-medium">
                    New Transaction
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Buy or sell Bitcoin
                  </p>
                </div>
              </Button>

              <Button 
                className="h-auto flex-col items-start justify-start p-4" 
                variant="outline" 
                onClick={handleOpenImportModal}
              >
                <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-full">
                  <Upload className="text-primary h-5 w-5" />
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm leading-none font-medium">
                    Import Transactions
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Import from CSV file
                  </p>
                </div>
              </Button>

              <Button 
                className="h-auto flex-col items-start justify-start p-4" 
                variant="outline" 
                onClick={() => router.push('/tax')}
              >
                <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-full">
                  <ReceiptText className="text-primary h-5 w-5" />
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm leading-none font-medium">
                    Tax Ledger
                  </p>
                  <p className="text-muted-foreground text-xs">
                    View capital gains & losses
                  </p>
                </div>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
          </DialogHeader>
          
          <TransactionImporter
            onSuccess={handleImportComplete}
            onCancel={handleCloseImportModal}
            isKeySet={isKeySet}
            encryptionKey={encryptionKey}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    throw new Error(`An error occurred while fetching the data: ${res.statusText}`);
  }
  return res.json();
}); 
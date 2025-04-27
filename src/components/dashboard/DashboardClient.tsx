"use client";

import { /* useEffect, useState */ } from 'react';
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
} from "lucide-react";

import { useBitcoinPrice } from '@/hooks/useBitcoinPrice';
import { formatUSD } from '@/lib/price';
import { calculatePortfolioSummary, getRecentTransactions } from '@/lib/portfolio';
import type { Transaction, PortfolioSummary } from '@/lib/types';
import { Spinner } from "@/components/Spinner";

import { AddTransactionForm } from '@/components/dashboard/AddTransactionForm';
import { format } from 'date-fns';

export function DashboardClient() {
  const { price: bitcoinPrice, lastUpdated, loading: priceLoading } = useBitcoinPrice();
  const router = useRouter();
  const { openDialog } = useDialog();
  const { data: transactions, error: transactionsError, isLoading: transactionsLoading, mutate: mutateTransactions } = 
    useSWR<Transaction[]>('/api/transactions', fetcher);
  
  if (transactionsLoading || priceLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }

  if (transactionsError) {
    return <div className="text-center text-red-500">Failed to load transaction data.</div>;
  }

  // Ensure currentTransactions is strictly an array
  const currentTransactions = Array.isArray(transactions) ? transactions : [];

  const portfolio = calculatePortfolioSummary(currentTransactions, bitcoinPrice);

  const safePortfolio: PortfolioSummary = {
    totalBTC: portfolio.totalBTC,
    costBasis: portfolio.costBasis,
    currentValue: portfolio.currentValue,
    unrealizedPnL: portfolio.unrealizedPnL ?? 0,
    percentageReturn: portfolio.percentageReturn ?? 0
  };

  const recentTransactions = getRecentTransactions(currentTransactions);

  const handleAddTransaction = () => {
    openDialog({
      title: "Add Transaction",
      component: AddTransactionForm,
      props: {
        onSuccess: () => {
          mutateTransactions();
        },
      },
    });
  };

  const handleViewAllTransactions = () => {
    router.push('/transactions');
  };

  const shouldShowPercentage = (value: number) => value !== 0;

  return (
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
            {currentTransactions.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">
                No transactions yet
              </div>
            ) : (
              recentTransactions.map((tx) => (
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
                    <p className="text-sm leading-none font-medium">
                      {tx.type === 'buy' ? 'Bought' : 'Sold'} {tx.amount.toFixed(8)} BTC
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(tx.timestamp), 'MMM d, yyyy, h:mm a')}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Wallet: {tx.wallet}
                    </p>
                    {tx.tags && tx.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tx.tags.map((tag) => (
                          <Badge key={tag} variant="outline" color="gray" size="sm">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatUSD(tx.amount * tx.price)}</p>
                    <p className="text-muted-foreground text-xs">
                      @ {formatUSD(tx.price)}/BTC
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Fee: {formatUSD(tx.fee)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="col-span-3 p-6">
          <h2 className="mb-6 text-xl font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
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
            >
              <div className="bg-primary/10 mb-2 flex h-10 w-10 items-center justify-center rounded-full">
                <BarChart3 className="text-primary h-5 w-5" />
              </div>
              <div className="space-y-1 text-left">
                <p className="text-sm leading-none font-medium">View Reports</p>
                <p className="text-muted-foreground text-xs">
                  Performance analytics
                </p>
              </div>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then(res => res.json()); 
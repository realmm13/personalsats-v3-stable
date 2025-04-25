"use client";

import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PortfolioLineChart from "./_components/PortfolioLineChart";
import TransactionList from "./_components/TransactionList";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, CreditCard, Clock } from "lucide-react";

interface Stats {
  totalValue: number;
  change24h: number;
  costBasis: number;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  date: string;
}

interface HistoryPoint {
  date: string;
  value: number;
}

export default function AppPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, historyRes, tradesRes] = await Promise.all([
          fetch('/api/portfolio/summary'),
          fetch('/api/portfolio/history'),
          fetch('/api/portfolio/trades')
        ]);

        if (!statsRes.ok || !historyRes.ok || !tradesRes.ok) {
          throw new Error('Failed to fetch portfolio data');
        }

        const [statsData, historyData, tradesData] = await Promise.all([
          statsRes.json(),
          historyRes.json(),
          tradesRes.json()
        ]);

        setStats(statsData);
        setHistory(historyData);
        setTrades(tradesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    }

    fetchData();
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const cards = [
    {
      title: "Total Revenue",
      value: `$${stats.totalValue.toLocaleString()}`,
      delta: "+20.1%",
      subtitle: "Compared to last month",
      icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Subscriptions",
      value: "+2,350",
      delta: "+10.5%",
      subtitle: "New subscribers this week",
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Sales",
      value: "+12,234",
      delta: "+15.3%",
      subtitle: "Total sales this month",
      icon: <CreditCard className="h-4 w-4 text-muted-foreground" />,
    },
    {
      title: "Active Users",
      value: "+573",
      delta: "+5.2%",
      subtitle: "Currently active users",
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
    }
  ];

  return (
    <div className="vertical space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bitcoin Dashboard</h1>
          <p className="text-muted-foreground">Always be stacking</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          className="w-full rounded-md border bg-background px-4 py-2 text-sm"
          placeholder="Search..."
          type="search"
        />
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {card.title}
              </h3>
              {card.icon}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{card.value}</div>
              <Badge color="green" className="bg-green-100 text-green-800">
                {card.delta}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {card.subtitle}
            </p>
          </Card>
        ))}
      </div>

      {/* Chart and Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Portfolio Value</h2>
          <PortfolioLineChart data={history} />
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
          <TransactionList trades={trades} />
        </Card>
      </div>
    </div>
  );
} 
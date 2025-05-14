'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import { useEncryption } from '@/context/EncryptionContext';
import { Spinner } from '@/components/Spinner';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { CostBasisMethod } from '@/lib/cost-basis';
import { Badge } from '@/components/ui/badge';

interface TaxLedgerRow {
  acquired: Date;
  disposed: Date;
  quantity: number;
  costBasis: number;
  proceeds: number;
  gain: number;
  term: string; // 'Long-Term' | 'Short-Term'
}

export default function TaxLedgerPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const { data, isLoading } = api.transactions.getTaxLedger.useQuery({ year });
  const { encryptionKey, isLoadingKey } = useEncryption();
  const [rows, setRows] = useState<TaxLedgerRow[] | null>(null);

  useEffect(() => {
    if (isLoading || isLoadingKey || !data || !encryptionKey) return;
    // If rows are encrypted, decrypt here. If not, just set them.
    // Assuming data.rows are NOT encrypted. If they are, add decryption logic as in DashboardClient.
    setRows(data.rows);
  }, [data, isLoading, encryptionKey, isLoadingKey]);

  if (isLoading || isLoadingKey || !rows) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  // Format USD utility (reuse from dashboard if available)
  const formatUSD = (n: number) => n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  // Sum up the gain column from the table rows
  const realizedGain = Array.isArray(rows) ? rows.reduce((sum, r) => sum + (typeof r.gain === 'number' ? r.gain : 0), 0) : 0;

  // Defensive: fallback values if data is missing or doesn't have the required properties
  const stGain = (data && 'realizedGainST' in data) ? Number(data.realizedGainST) : 0;
  const ltGain = (data && 'realizedGainLT' in data) ? Number(data.realizedGainLT) : 0;

  // Calculate percentage gain/loss for realized gain
  const totalCostBasis = Array.isArray(rows) ? rows.reduce((sum, r) => sum + (typeof r.costBasis === 'number' ? r.costBasis : 0), 0) : 0;
  const realizedPercent = totalCostBasis > 0 ? (realizedGain / totalCostBasis) * 100 : 0;
  const percentLabel = `${realizedPercent >= 0 ? '+' : ''}${realizedPercent.toFixed(1)}%`;

  return (
    <div className="vertical space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tax Ledger</h1>
        </div>
      </div>
      {/* Summary Boxes - moved here to be directly under the title/subtitle */}
      <div className="grid gap-4 md:grid-cols-3 mt-2">
        <Card className="p-6">
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground text-sm font-medium">Realized Gain/Loss</span>
            <span className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{formatUSD(realizedGain)}</span>
              <Badge variant="default" color={realizedPercent >= 0 ? 'green' : 'red'}>{percentLabel}</Badge>
            </span>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground text-sm font-medium">Short-term Realized Gains ($)</span>
            <span className="text-2xl font-bold text-white">{formatUSD(Number(stGain))}</span>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex flex-col space-y-1">
            <span className="text-muted-foreground text-sm font-medium">Long-term Realized Gains ($)</span>
            <span className="text-2xl font-bold text-white">{formatUSD(Number(ltGain))}</span>
          </div>
        </Card>
      </div>
      <div className="flex gap-4">
        <select
          value={year}
          onChange={e => setYear(+e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          {[2025, 2024, 2023].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <span className="px-3 py-2 border rounded-md bg-muted">HIFO</span>
      </div>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead>Acquired</TableHead>
              <TableHead>Disposed</TableHead>
              <TableHead className="text-right">Qty (BTC)</TableHead>
              <TableHead className="text-right">Cost Basis</TableHead>
              <TableHead className="text-right">Proceeds</TableHead>
              <TableHead className="text-right">Gain/Loss</TableHead>
              <TableHead>Term</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: TaxLedgerRow, i: number) => (
              <TableRow key={i}>
                <TableCell>{r.acquired.toISOString().slice(0,10)}</TableCell>
                <TableCell>{r.disposed.toISOString().slice(0,10)}</TableCell>
                <TableCell className="text-right">{r.quantity.toFixed(8)}</TableCell>
                <TableCell className="text-right">${r.costBasis.toFixed(2)}</TableCell>
                <TableCell className="text-right">${r.proceeds.toFixed(2)}</TableCell>
                <TableCell className={`text-right ${r.gain < 0 ? 'text-red-500' : 'text-green-500'}`}>${r.gain.toFixed(2)}</TableCell>
                <TableCell>{r.term}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
} 
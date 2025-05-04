'use client';

import { useState, useEffect } from 'react';
import { api } from '@/trpc/react';
import { CostBasisMethod } from '@/lib/cost-basis';
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
  const [method, setMethod] = useState<CostBasisMethod>(CostBasisMethod.FIFO);
  const { data, isLoading } = api.transactions.getTaxLedger.useQuery({ year, method });
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

  return (
    <div className="vertical space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tax Ledger</h1>
          <p className="text-muted-foreground">View your realized gains and losses</p>
        </div>
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
        <select
          value={method}
          onChange={e => setMethod(e.target.value as CostBasisMethod)}
          className="px-3 py-2 border rounded-md"
        >
          {(Object.values(CostBasisMethod) as string[]).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
import React from 'react'
import { format } from 'date-fns'
import { Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '@/lib/types' // Assuming Transaction type includes needed fields
import { cn } from "@/lib/utils"
import { formatUSD } from "@/lib/price"
import { CustomButton } from "@/components/CustomButton" // Use CustomButton for actions

// Define ProcessedTransaction if different from Transaction (e.g., includes isDecrypted)
// For simplicity, assuming props pass data conformant to Transaction for now
type ProcessedTransaction = Transaction & { isDecrypted?: boolean };

interface TransactionsTableProps {
  transactions: ProcessedTransaction[];
  onEdit: (tx: ProcessedTransaction) => void; // Handler for editing
  onDelete: (id: string) => void; // Handler for deleting
}

// Helper to format currency conditionally
const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
  if (typeof value !== 'number') return '–';
  // Basic USD formatting, enhance as needed
  return currency === 'USD' 
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${value.toLocaleString()} ${currency}`;
};

export function TransactionsTable({ transactions, onEdit, onDelete }: TransactionsTableProps) {
  // Handle empty state
  if (!transactions || transactions.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No transactions to display.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full table-auto border-collapse">
        <thead className="bg-card">
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Wallet</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount (BTC)</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Value</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Fee</th>
            <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card text-sm">
          {transactions.map((tx) => {
            const date = tx.isDecrypted && tx.timestamp instanceof Date && !isNaN(tx.timestamp.getTime()) ? 
                         format(tx.timestamp, 'MMM d, yyyy, h:mm a') : '...';
            const typeLabel = tx.isDecrypted && tx.type ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1) : 'Processing...';
            const wallet = tx.isDecrypted ? (tx.wallet ?? '-') : '...';
            const amount = tx.isDecrypted && typeof tx.amount === 'number' ? tx.amount.toFixed(8) : '...';
            const price = tx.isDecrypted && typeof tx.price === 'number' ? formatUSD(tx.price) : '...';
            const value = tx.isDecrypted && typeof tx.amount === 'number' && typeof tx.price === 'number' ? 
                          formatUSD(tx.amount * tx.price) : '...';
            const fee = tx.isDecrypted && typeof tx.fee === 'number' && tx.fee !== 0 ? formatUSD(tx.fee) : (tx.isDecrypted ? '-' : '...');

            return (
              <tr key={tx.id} className={`hover:bg-muted/50 ${!tx.isDecrypted ? 'opacity-60' : ''}`}>
                <td className="px-4 py-2 whitespace-nowrap text-foreground">{date}</td>
                <td className={cn("px-4 py-2 whitespace-nowrap font-medium", 
                   tx.type === 'buy' && 'text-green-500',
                   tx.type === 'sell' && 'text-red-500',
                   !tx.isDecrypted && 'italic text-muted-foreground'
                   )}>
                   {typeLabel}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{wallet}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-foreground font-medium">{amount}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-muted-foreground">{price}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-foreground font-medium">{value}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-muted-foreground">{fee}</td>
                <td className="px-4 py-2 whitespace-nowrap text-center">
                  {tx.isDecrypted ? (
                    <div className="flex justify-center items-center space-x-1">
                      <CustomButton variant="ghost" size="sm" className="h-auto p-1 text-muted-foreground hover:text-foreground" onClick={() => onEdit(tx)} tooltip="Edit">
                        <Pencil size={14}/>
                      </CustomButton>
                      <CustomButton variant="ghost" size="sm" color="destructive" className="h-auto p-1" onClick={() => onDelete(tx.id)} tooltip="Delete">
                        <Trash2 size={14}/>
                      </CustomButton>
                    </div>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
} 
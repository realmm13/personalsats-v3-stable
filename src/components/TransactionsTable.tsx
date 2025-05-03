import React, { useState } from 'react'
import { format } from 'date-fns'
import { Pencil, Trash2, Trash } from 'lucide-react'
import type { Transaction } from '@/lib/types' // Assuming Transaction type includes needed fields
import { cn } from "@/lib/utils"
import { formatUSD } from "@/lib/price"
import { CustomButton } from "@/components/CustomButton" // Use CustomButton for actions
import { api } from "@/trpc/react"; // Import tRPC hook
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"; // Import AlertDialog for confirmation
import { toast } from 'sonner'; // For success/error messages
import { Spinner } from '@/components/Spinner'; // Add Spinner import

// Define ProcessedTransaction if different from Transaction (e.g., includes isDecrypted)
// For simplicity, assuming props pass data conformant to Transaction for now
type ProcessedTransaction = Transaction & { isDecrypted?: boolean };

interface TransactionsTableProps {
  transactions: ProcessedTransaction[];
  onEdit: (tx: ProcessedTransaction) => void; // Handler for editing
  onDelete: (id: string) => void; // Handler for deleting
  // Add a prop to trigger refetch in the parent component after bulk actions
  onBulkActionComplete?: () => void;
}

// Helper to format currency conditionally
const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
  if (typeof value !== 'number') return '–';
  // Basic USD formatting, enhance as needed
  return currency === 'USD' 
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${value.toLocaleString()} ${currency}`;
};

export function TransactionsTable({ 
  transactions, 
  onEdit, 
  onDelete, 
  onBulkActionComplete 
}: TransactionsTableProps) {
  
  // --- State for selection and confirmation --- 
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  
  // --- tRPC Mutation Hooks --- 
  const deleteManyMutation = api.transactions.deleteMany.useMutation();

  // --- Handlers --- 
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map(t => t.id)));
    }
  };

  const handleBulkDeleteConfirm = async () => {
    const idsToDelete = Array.from(selected);
    try {
      toast.info(`Deleting ${idsToDelete.length} transactions...`);
      await deleteManyMutation.mutateAsync(idsToDelete);
      toast.success("Transactions deleted successfully!");
      setSelected(new Set()); // Clear selection
      onBulkActionComplete?.(); // Trigger parent refetch
    } catch (error) { 
      console.error("Bulk delete failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete selected transactions."); 
    }
    setConfirmDeleteOpen(false); // Close dialog regardless of outcome
  };

  // --- Derived State --- 
  const numSelected = selected.size;
  const isAllSelected = transactions.length > 0 && numSelected === transactions.length;
  const isIndeterminate = numSelected > 0 && numSelected < transactions.length;

  // Handle empty state
  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-muted-foreground">No transactions to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- Bulk Action Bar --- */} 
      {numSelected > 0 && (
        <div className="flex items-center justify-between space-x-2 bg-muted/50 px-4 py-2 rounded-md border">
          <span className="text-sm font-medium">{numSelected} selected</span>
          <div className="flex items-center space-x-2">
             <CustomButton 
              variant="filled"
              color="destructive"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)} 
              leftIcon={Trash} 
              loading={deleteManyMutation.isPending}
            >
              Delete Selected
            </CustomButton>
            <CustomButton 
              variant="outline" 
              size="sm" 
              onClick={() => setSelected(new Set())}
            >
              Cancel Selection
            </CustomButton>
          </div>
        </div>
      )}
      
      {/* --- Table --- */} 
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full table-auto border-collapse">
        <thead className="bg-card">
          <tr className="border-b border-border">
              <th className="px-4 py-3 text-left">
                <Checkbox 
                  checked={isIndeterminate ? "indeterminate" : isAllSelected}
                  onCheckedChange={toggleAllRows}
                  aria-label="Select all rows"
                />
              </th>
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
                <tr key={tx.id} className={`hover:bg-muted/50 ${!tx.isDecrypted ? 'opacity-60' : ''} ${selected.has(tx.id) ? 'bg-muted' : ''}`}>
                  <td className="px-4 py-2">
                    <Checkbox 
                      checked={selected.has(tx.id)}
                      onCheckedChange={() => toggleRow(tx.id)}
                      aria-label={`Select row ${tx.id}`}
                    />
                  </td>
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
      
      {/* --- Confirmation Dialogs --- */}
      {/* Bulk Delete Confirmation */} 
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {numSelected} selected transaction(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDeleteConfirm} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteManyMutation.isPending} 
            >
              {deleteManyMutation.isPending ? <Spinner size="sm" /> : "Delete Selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
} 
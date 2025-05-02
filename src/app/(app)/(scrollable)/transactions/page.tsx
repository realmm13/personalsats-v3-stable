"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, ArrowUpRight, ArrowDownRight, Trash2, Clock, Pencil, Upload } from "lucide-react";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { useAlerts } from "@/components/AlertContext";
import { FormFieldSegmentedControl } from "@/components/FormFieldSegmentedControl";
import { Spinner } from "@/components/Spinner";
import { useDialog } from "@/components/DialogManager";
import useSWR from "swr";
import { type Transaction } from "@/lib/types";
import { AddTransactionForm } from "@/components/dashboard/AddTransactionForm";
import { Badge } from "@/components/ui/badge";
import { formatUSD } from "@/lib/price";
import { useEncryption } from "@/context/EncryptionContext";
import { PassphrasePrompt } from "@/components/PassphrasePrompt";
import { decryptString } from "@/lib/encryption";
import { toast } from "sonner";
import { EditTransactionForm } from "@/components/dashboard/EditTransactionForm";
import { TransactionImporter } from "@/components/import/TransactionImporter";
import { TransactionsTable } from "@/components/TransactionsTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define ProcessedTransaction with optional/undefined decryptionError
type ProcessedTransaction = Transaction & {
  isDecrypted?: boolean;
};

// Define fetcher for useSWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) {
    // You might want more sophisticated error handling here
    throw new Error(`An error occurred while fetching the data: ${res.statusText}`);
  }
  return res.json();
});

export default function TransactionsPage() {
  // Restore page-level state and logic
  const { openDialog: openAddTransactionDialog } = useDialog();
  const { openDialog: openEditDialog, closeDialog } = useDialog(); // Use separate name for clarity
  const { confirmAlertDelete } = useAlerts();
  
  // --- Add Filter State --- 
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell" | "deposit" | "withdrawal">("all");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  // ----------------------

  // --- Construct Filtered URL ---
  const constructApiUrl = () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") {
      params.append('type', typeFilter);
    }
    if (minValue) {
      params.append('minValue', minValue);
    }
    if (maxValue) {
      params.append('maxValue', maxValue);
    }
    const queryString = params.toString();
    return `/api/transactions${queryString ? '?' + queryString : ''}`;
  };
  const apiUrl = constructApiUrl();
  // -----------------------------
  
  // Use dynamic apiUrl for useSWR
  const { data: rawTransactions, error: swrError, isLoading: swrLoading, mutate: mutateTransactions } = 
    useSWR<Transaction[]>(apiUrl, fetcher);
  const { encryptionKey, isLoadingKey, isKeySet } = useEncryption();
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Decryption useEffect (keep as is)
  useEffect(() => {
    const processAndDecrypt = async () => {
       if (!rawTransactions || !isKeySet || !encryptionKey) { setProcessedTransactions([]); return; }
       setIsProcessing(true);
       try {
         const results = await Promise.all(
           rawTransactions.map(async (tx): Promise<ProcessedTransaction> => {
             if (tx.encryptedData && encryptionKey) {
               try {
                 const decryptedString = await decryptString(tx.encryptedData, encryptionKey);
                 const decryptedObject = JSON.parse(decryptedString);
                 return { ...tx, ...decryptedObject, timestamp: new Date(tx.timestamp), isDecrypted: true, encryptedData: null };
               } catch (error) { console.error(`❌ Decrypt error ${tx.id}:`, error); return { ...tx, timestamp: new Date(tx.timestamp), isDecrypted: false }; }
             } else { return { ...tx, timestamp: new Date(tx.timestamp), isDecrypted: false }; }
           })
         );
         setProcessedTransactions(results);
       } catch (processingError) { console.error("Error processing:", processingError); }
       finally { setIsProcessing(false); }
    };
    processAndDecrypt();
  }, [rawTransactions, encryptionKey, isKeySet]);

  // --- Client-Side Filtering Logic ---
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter(tx => {
      // Ensure transaction is decrypted before filtering on potentially encrypted fields
      if (!tx.isDecrypted) {
        // Decide how to handle undecrypted - include or exclude?
        // Excluding them seems safer for filtering consistency.
        return false; 
      }

      // Type Filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Min Value (Price) Filter - check if price exists
      if (minValue && (typeof tx.price !== 'number' || tx.price < parseFloat(minValue))) {
        return false;
      }

      // Max Value (Price) Filter - check if price exists
      if (maxValue && (typeof tx.price !== 'number' || tx.price > parseFloat(maxValue))) {
        return false;
      }
      
      // Add other client-side filters here (e.g., date range, wallet)

      return true; // Include transaction if all filters pass
    });
  }, [processedTransactions, typeFilter, minValue, maxValue]);
  // -----------------------------------

  // Restore Handlers here
  const handleAddTransaction = () => {
    openAddTransactionDialog({ /* ... add dialog config ... */ title: "Add Transaction", component: AddTransactionForm, props: { onSuccess: () => mutateTransactions() } });
  };
  const handleOpenImportModal = () => { setIsImportModalOpen(true); };
  const handleCloseImportModal = () => { setIsImportModalOpen(false); };
  const handleImportComplete = () => { setIsImportModalOpen(false); mutateTransactions(); };

  const handleEdit = (txToEdit: ProcessedTransaction) => {
    if (!txToEdit.isDecrypted) { toast.error("Cannot edit undecrypted transaction."); return; }
    const dialogId = openEditDialog({
        title: "Edit Transaction", component: EditTransactionForm,
        props: { transaction: txToEdit, onSuccess: () => { mutateTransactions(); if (dialogId) closeDialog(dialogId); }, onCancel: () => { if (dialogId) closeDialog(dialogId); } },
    });
  };
  
  const handleDelete = (id: string) => {
    const originalTransactions = [...processedTransactions]; // Use state here
    confirmAlertDelete({
      title: "Delete Transaction", description: "Are you sure? This cannot be undone.",
      onConfirm: async () => {
        // Optimistic UI update on page state
        setProcessedTransactions(currentTxs => currentTxs.filter(tx => tx.id !== id));
        try {
          const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
          if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || "Failed on server"); }
          toast.success("Transaction deleted!");
          // No need to call mutate if optimistic update is sufficient
        } catch (error) {
          setProcessedTransactions(originalTransactions); // Revert on error
          toast.error(error instanceof Error ? error.message : "Could not delete.");
        }
      },
    });
  };

  // Restore loading/error states
  if (!isKeySet) return <PassphrasePrompt sampleEncryptedData={rawTransactions?.find(tx => tx.encryptedData)?.encryptedData} />;
  if (swrError) return <div>Failed to load transactions data. Please try again.</div>;
  // Show loading if SWR is loading OR if decrypting and no processed data yet
  if (swrLoading || (isProcessing && processedTransactions.length === 0)) return <Spinner />;
  // Show "No transactions" only if not loading/processing AND raw data was empty OR filtered data is empty
  const showNoTransactions = !isProcessing && 
                              ((rawTransactions && rawTransactions.length === 0) || 
                               (processedTransactions.length > 0 && filteredTransactions.length === 0));
  if (showNoTransactions) 
      return <div className="text-center text-muted-foreground py-8">No transactions found{typeFilter !== 'all' || minValue || maxValue ? ' matching filters' : ''}.</div>;
  // Show passphrase prompt if key not set and raw data exists but not processed
  if (!isKeySet && processedTransactions.length === 0 && rawTransactions && rawTransactions.length > 0) 
      return <div className="text-center text-muted-foreground py-8">Enter passphrase to view details.</div>;

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center space-x-2">
          <CustomButton onClick={handleOpenImportModal} leftIcon={Upload} variant="outline" size="sm">Import from File</CustomButton>
          <CustomButton onClick={handleAddTransaction} leftIcon={Plus} variant="filled" color="primary" size="sm">Add Transaction</CustomButton>
        </div>
      </div>

      {/* === ADD FILTER CONTROLS HERE === */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card border rounded-lg">
        <span className="font-medium text-sm">Filters:</span>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as any)} // Cast needed for 'all' initially
        >
          <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>      {/* Add other types if needed */}
            <SelectItem value="withdrawal">Withdrawal</SelectItem>  {/* Add other types if needed */}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Min Price ($)" // Assuming filtering by price
          value={minValue}
          onChange={(e) => setMinValue(e.target.value)}
          className="w-auto min-w-[120px] h-9 text-sm"
          step="any"
          min="0"
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="number"
          placeholder="Max Price ($)" // Assuming filtering by price
          value={maxValue}
          onChange={(e) => setMaxValue(e.target.value)}
          className="w-auto min-w-[120px] h-9 text-sm"
          step="any"
          min="0"
        />
        {/* Optional: Add Apply button if needed: <Button onClick={() => mutateTransactions()} size="sm">Apply</Button> */}
      </div>
      {/* ============================= */}

      {/* Render the table component, passing FILTERED data */}
      <TransactionsTable 
         transactions={filteredTransactions} // Pass filtered data
         onEdit={handleEdit}
         onDelete={handleDelete}
      />

      {/* Keep Import Dialog rendering */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Import Transactions from CSV</DialogTitle></DialogHeader>
          <TransactionImporter 
            onSuccess={handleImportComplete} 
            onCancel={handleCloseImportModal} 
            isKeySet={isKeySet}
            encryptionKey={encryptionKey}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 
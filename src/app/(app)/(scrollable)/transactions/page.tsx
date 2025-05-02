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
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { api } from "@/trpc/react";

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
  // --- Hooks ---
  const { openDialog: openAddTransactionDialog } = useDialog();
  const { openDialog: openEditDialog, closeDialog } = useDialog();
  const { confirmAlertDelete } = useAlerts();
  const { encryptionKey, isLoadingKey, isKeySet } = useEncryption();
  const clearAllMutation = api.transactions.clearAll.useMutation();

  // --- State ---
  const [typeFilter, setTypeFilter] = useState<"all" | "buy" | "sell" | "deposit" | "withdrawal">("all");
  const [minAmount, setMinAmount] = useState<string>(""); 
  const [minAmountInput, setMinAmountInput] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>(""); 
  const [maxAmountInput, setMaxAmountInput] = useState<string>(""); 
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [secondConfirmClearOpen, setSecondConfirmClearOpen] = useState(false);

  // --- Debounce Min/Max Amount --- 
  useEffect(() => {
    const minHandler = setTimeout(() => { setMinAmount(minAmountInput); }, 500); 
    const maxHandler = setTimeout(() => { setMaxAmount(maxAmountInput); }, 500);
    return () => { 
        clearTimeout(minHandler); 
        clearTimeout(maxHandler); 
    };
  }, [minAmountInput, maxAmountInput]);
  
  // --- Fetch Data --- 
  const apiUrl = "/api/transactions"; // API fetches all, filtering is client-side
  const { data: rawTransactions, error: swrError, isLoading: swrLoading, mutate: mutateTransactions } = 
    useSWR<Transaction[]>(apiUrl, fetcher);

  // --- Decryption Effect ---
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

  // --- Client-Side Filtering --- 
  const filteredTransactions = useMemo(() => {
    return processedTransactions.filter(tx => {
      if (!tx.isDecrypted) return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (minAmount && (typeof tx.amount !== 'number' || tx.amount < parseFloat(minAmount))) return false;
      if (maxAmount && (typeof tx.amount !== 'number' || tx.amount > parseFloat(maxAmount))) return false;
      return true; 
    });
  }, [processedTransactions, typeFilter, minAmount, maxAmount]); 

  // --- Handlers ---
  const handleAddTransaction = () => {
    openAddTransactionDialog({ title: "Add Transaction", component: AddTransactionForm, props: { onSuccess: () => mutateTransactions() } });
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
    const originalTransactions = [...processedTransactions]; 
    confirmAlertDelete({
      title: "Delete Transaction", description: "Are you sure? This cannot be undone.",
      onConfirm: async () => {
        setProcessedTransactions(currentTxs => currentTxs.filter(tx => tx.id !== id));
        try {
          const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
          if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || "Failed on server"); }
          toast.success("Transaction deleted!");
        } catch (error) {
          setProcessedTransactions(originalTransactions); 
          toast.error(error instanceof Error ? error.message : "Could not delete.");
        }
      },
    });
  };

  const handleClearAllConfirm = async () => {
    setConfirmClearOpen(false);
    setSecondConfirmClearOpen(true);
  };

  const handleFinalClearAll = async () => {
    setSecondConfirmClearOpen(false);
    try {
      toast.info("Clearing all transactions...");
      await clearAllMutation.mutateAsync();
      toast.success("All transactions cleared successfully!");
      mutateTransactions(); 
    } catch (error) {
      console.error("Clear all failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to clear all transactions.");
    }
  };

  // --- Loading / Error / Empty States ---
  if (!isKeySet) return <PassphrasePrompt sampleEncryptedData={rawTransactions?.find(tx => tx.encryptedData)?.encryptedData} />;
  if (swrError) return <div className="text-center text-muted-foreground py-8">Failed to load transactions data. Please try again.</div>; // Centered error
  if (swrLoading || (isProcessing && processedTransactions.length === 0)) return <div className="flex justify-center py-8"><Spinner size="lg"/></div>; // Centered spinner
  const showNoTransactions = !isProcessing && 
                              ((!rawTransactions || rawTransactions.length === 0) || 
                               (processedTransactions.length > 0 && filteredTransactions.length === 0));
  if (showNoTransactions) 
      return (
          <div className="container py-8 space-y-6">
             {/* Render header and filters even when empty */} 
             <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Transactions</h1>
                <div className="flex items-center space-x-2">
                    {/* Buttons... */} 
                    <CustomButton onClick={handleOpenImportModal} leftIcon={Upload} variant="outline" size="sm">Import from File</CustomButton>
                    <CustomButton onClick={handleAddTransaction} leftIcon={Plus} variant="filled" color="primary" size="sm">Add Transaction</CustomButton>
                    <CustomButton variant="outline" color="destructive" size="sm" onClick={() => setConfirmClearOpen(true)} loading={clearAllMutation.isPending} leftIcon={Trash2}>
                        Clear All
                    </CustomButton>
                </div>
             </div>
             <div className="flex flex-wrap items-center gap-4 p-4 bg-card border rounded-lg">
                 {/* Filter controls... */} 
                 <span className="font-medium text-sm">Filters:</span>
                 <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} >
                    <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                    </SelectContent>
                 </Select>
                 <Input type="number" placeholder="Min Amount (BTC)" value={minAmountInput} onChange={(e) => setMinAmountInput(e.target.value)} className="w-auto min-w-[140px] h-9 text-sm" step="any" min="0" />
                 <span className="text-muted-foreground">-</span>
                 <Input type="number" placeholder="Max Amount (BTC)" value={maxAmountInput} onChange={(e) => setMaxAmountInput(e.target.value)} className="w-auto min-w-[140px] h-9 text-sm" step="any" min="0" />
             </div>
            {/* The actual empty message */} 
            <div className="text-center text-muted-foreground py-8">No transactions found{typeFilter !== 'all' || minAmount || maxAmount ? ' matching filters' : ''}.</div>
            {/* Clear All Dialog needs to be rendered here too */} 
             <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
                <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Clear ALL Transactions?</AlertDialogTitle>
                     <AlertDialogDescription>
                       This will permanently delete every transaction and related tax data (lots, allocations) in your account. This action cannot be undone.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction 
                       onClick={handleClearAllConfirm} 
                       className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                       disabled={clearAllMutation.isPending} 
                     >
                       {clearAllMutation.isPending ? <Spinner size="sm" /> : "Yes, Clear All"}
                     </AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>
             {/* Second Confirmation Dialog for Clear All */}
             <AlertDialog open={secondConfirmClearOpen} onOpenChange={setSecondConfirmClearOpen}>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>ARE YOU ABSOLUTELY SURE?</AlertDialogTitle>
                   <AlertDialogDescription>
                     This action cannot be undone. This will permanently delete all transactions, lots, and allocation data. There is no going back.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                   <AlertDialogAction 
                     onClick={handleFinalClearAll} 
                     className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                     disabled={clearAllMutation.isPending} 
                   >
                     {clearAllMutation.isPending ? <Spinner size="sm" /> : "Yes, Permanently Delete All"}
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
          </div>
       );
  if (!isKeySet && processedTransactions.length === 0 && rawTransactions && rawTransactions.length > 0) 
      return <div className="text-center text-muted-foreground py-8">Enter passphrase to view details.</div>;

  // --- Main Render --- 
  return (
    <div className="container py-8 space-y-6">
      {/* Header */} 
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center space-x-2">
          <CustomButton onClick={handleOpenImportModal} leftIcon={Upload} variant="outline" size="sm">Import from File</CustomButton>
          <CustomButton onClick={handleAddTransaction} leftIcon={Plus} variant="filled" color="primary" size="sm">Add Transaction</CustomButton>
          <CustomButton variant="outline" color="destructive" size="sm" onClick={() => setConfirmClearOpen(true)} loading={clearAllMutation.isPending} leftIcon={Trash2}>
            Clear All
          </CustomButton>
        </div>
      </div>

      {/* Filters */} 
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card border rounded-lg">
        <span className="font-medium text-sm">Filters:</span>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)} >
            <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
            </SelectContent>
        </Select>
        <Input type="number" placeholder="Min Amount (BTC)" value={minAmountInput} onChange={(e) => setMinAmountInput(e.target.value)} className="w-auto min-w-[140px] h-9 text-sm" step="any" min="0" />
        <span className="text-muted-foreground">-</span>
        <Input type="number" placeholder="Max Amount (BTC)" value={maxAmountInput} onChange={(e) => setMaxAmountInput(e.target.value)} className="w-auto min-w-[140px] h-9 text-sm" step="any" min="0" />
      </div>

      {/* Table */} 
      <TransactionsTable 
         transactions={filteredTransactions} 
         onEdit={handleEdit}
         onDelete={handleDelete}
         onBulkActionComplete={mutateTransactions}
      />

      {/* Dialogs */} 
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
      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
         <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear ALL Transactions?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every transaction and related tax data (lots, allocations) in your account. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleClearAllConfirm} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={clearAllMutation.isPending} 
              >
                {clearAllMutation.isPending ? <Spinner size="sm" /> : "Yes, Clear All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      {/* Second Confirmation Dialog for Clear All */}
      <AlertDialog open={secondConfirmClearOpen} onOpenChange={setSecondConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ARE YOU ABSOLUTELY SURE?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all transactions, lots, and allocation data. There is no going back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFinalClearAll} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearAllMutation.isPending} 
            >
              {clearAllMutation.isPending ? <Spinner size="sm" /> : "Yes, Permanently Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 
"use client";

import { useState, useEffect } from "react";
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

// Define ProcessedTransaction with optional/undefined decryptionError
type ProcessedTransaction = Transaction & {
  isDecrypted?: boolean;
};

// Define fetcher for useSWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function TransactionsPage() {
  // Restore page-level state and logic
  const { openDialog: openAddTransactionDialog } = useDialog();
  const { openDialog: openEditDialog, closeDialog } = useDialog(); // Use separate name for clarity
  const { confirmAlertDelete } = useAlerts();
  const { data: rawTransactions, error: swrError, isLoading: swrLoading, mutate: mutateTransactions } = 
    useSWR<Transaction[]>("/api/transactions", fetcher);
  const { encryptionKey, isLoadingKey, isKeySet } = useEncryption();
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Restore Decryption logic here
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
  if (swrLoading || (isProcessing && processedTransactions.length === 0)) return <Spinner />;
  // Use processedTransactions for empty check after potential decryption
  if (!isProcessing && processedTransactions.length === 0 && rawTransactions && rawTransactions.length === 0) 
      return <div className="text-center text-muted-foreground py-8">No transactions found.</div>;
  if (!isKeySet && processedTransactions.length === 0) 
      return <div className="text-center text-muted-foreground py-8">Enter passphrase to view details.</div>; // Or handle differently

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center space-x-2">
          <CustomButton onClick={handleOpenImportModal} leftIcon={Upload} variant="outline" size="sm">Import from File</CustomButton>
          <CustomButton onClick={handleAddTransaction} leftIcon={Plus} variant="filled" color="primary" size="sm">Add Transaction</CustomButton>
        </div>
      </div>

      {/* Render the new table component, passing data and handlers */}
      <TransactionsTable 
         transactions={processedTransactions}
         onEdit={handleEdit}
         onDelete={handleDelete}
      />

      {/* Keep Import Dialog rendering */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Import Transactions from CSV</DialogTitle></DialogHeader>
          <TransactionImporter onSuccess={handleImportComplete} onCancel={handleCloseImportModal} />
        </DialogContent>
      </Dialog>
    </div>
  );
} 
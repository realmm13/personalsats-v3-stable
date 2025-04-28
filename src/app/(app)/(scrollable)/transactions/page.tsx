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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";

// Define ProcessedTransaction with optional/undefined decryptionError
type ProcessedTransaction = Transaction & {
  isDecrypted?: boolean;
};

// Define fetcher for useSWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

function TransactionList() {
  const { data: rawTransactions, error: swrError, isLoading: swrLoading, mutate: mutateSWR } = 
    useSWR<Transaction[]>("/api/transactions", fetcher);
  const { encryptionKey, isLoadingKey, isKeySet } = useEncryption();
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { confirmAlert } = useAlerts();
  const { confirmAlertDelete } = useAlerts();
  const { openDialog, closeDialog } = useDialog();

  useEffect(() => {
    const processAndDecrypt = async () => {
      console.log("processAndDecrypt: isKeySet?", isKeySet, "encryptionKey exists?", !!encryptionKey);

      if (!rawTransactions || !isKeySet || !encryptionKey) {
        setProcessedTransactions([]);
        return;
      }

      console.log("processAndDecrypt: Proceeding with key:", encryptionKey);

      setIsProcessing(true);
      try {
        const results = await Promise.all(
          rawTransactions.map(async (tx): Promise<ProcessedTransaction> => {
            const timestamp = new Date(tx.timestamp);
            
            if (tx.encryptedData && encryptionKey) {
              try {
                const decryptedString = await decryptString(tx.encryptedData, encryptionKey);
                const decryptedObject = JSON.parse(decryptedString);
                return {
                  ...tx,
                  ...decryptedObject,
                  timestamp: new Date(tx.timestamp),
                  isDecrypted: true,
                  encryptedData: null,
                };
              } catch (error) {
                console.error(`❌ Failed to decrypt transaction ${tx.id}:`, error);
                return {
                  ...tx,
                  timestamp: new Date(tx.timestamp),
                  isDecrypted: false,
                };
              }
            } else {
              return {
                ...tx,
                timestamp: new Date(tx.timestamp),
                isDecrypted: false,
              };
            }
          })
        );
        setProcessedTransactions(results);
      } catch (processingError) {
        console.error("Error processing transactions:", processingError);
      } finally {
        setIsProcessing(false);
      }
    };

    processAndDecrypt();
  }, [rawTransactions, encryptionKey, isKeySet]);

  const handleEdit = (txToEdit: ProcessedTransaction) => {
    if (!txToEdit.isDecrypted) {
        toast.error("Cannot edit a transaction that failed to decrypt.");
        return;
    }
    const dialogId = openDialog({
        title: "Edit Transaction",
        component: EditTransactionForm,
        props: {
            transaction: txToEdit,
            onSuccess: () => {
                mutateSWR();
                if (dialogId) closeDialog(dialogId);
            },
            onCancel: () => {
                 if (dialogId) closeDialog(dialogId);
            },
        },
    });
  };

  const handleDelete = (id: string) => {
    const transactionToDelete = processedTransactions.find(tx => tx.id === id);
    if (!transactionToDelete) return;
    const originalTransactions = [...processedTransactions];

    confirmAlertDelete({
      title: "Delete Transaction",
      description: "Are you sure you want to delete this transaction? This action cannot be undone.",
      onConfirm: async () => {
        setProcessedTransactions(currentTxs => currentTxs.filter(tx => tx.id !== id));

        try {
          const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to delete transaction on server");
          }

          toast.success("Transaction deleted successfully!");

        } catch (error) {
          console.error("Error deleting transaction:", error);
          setProcessedTransactions(originalTransactions);
          toast.error(error instanceof Error ? error.message : "Could not delete transaction.");
        }
      },
    });
  };

  if (!isKeySet) {
    // Pass sample data to the prompt
    const sampleData = rawTransactions?.find(tx => tx.encryptedData)?.encryptedData;
    return <PassphrasePrompt sampleEncryptedData={sampleData} />;
  }

  if (swrError) return <div>Failed to load transactions data. Please try again.</div>;
  if (swrLoading || (isProcessing && processedTransactions.length === 0)) return <Spinner />;
  
  if (!rawTransactions || rawTransactions.length === 0) {
    return <div className="text-center text-muted-foreground py-8">No transactions found.</div>;
  }
  
  if (!isKeySet && processedTransactions.length === 0) {
     return <div className="text-center text-muted-foreground py-8">Enter passphrase to view details.</div>;
  }

  return (
    <div className="space-y-4">
      {processedTransactions.map((tx) => (
        <div
          key={tx.id}
          className={`flex items-start gap-4 rounded-lg border p-3 ${!tx.isDecrypted ? 'opacity-70' : 'bg-card'}`}
        >
          <div className="bg-primary/10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full">
            {tx.type === 'buy' ? (
              <ArrowUpRight className="text-primary h-5 w-5" />
            ) : tx.type === 'sell' ? (
              <ArrowDownRight className="text-primary h-5 w-5" />
            ) : (
              <Clock className="text-muted-foreground h-5 w-5" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm leading-none font-medium">
              {(tx.type ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1) : 'Processing...')} 
              {' '}
              {typeof tx.amount === 'number' ? `${tx.amount.toFixed(6)} BTC` : '...'}
            </p>
            <p className="text-muted-foreground text-xs">
              {tx.timestamp instanceof Date && !isNaN(tx.timestamp.getTime()) ? format(tx.timestamp, 'MMM d, yyyy, h:mm a') : '...'}
            </p>
            {tx.wallet ? (
              <p className="text-muted-foreground text-xs">
                Wallet: {tx.wallet}
              </p>
            ) : tx.isDecrypted ? null : (<p className="text-muted-foreground text-xs italic">...</p>) }
            
            {(tx.tags && tx.tags.length > 0) ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {tx.tags.map((tag) => (
                  <Badge key={tag} variant="outline" color="gray" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : tx.isDecrypted ? null : (<div className="text-xs text-muted-foreground italic">...</div>) }
            
            {tx.notes && (
              <div className="text-sm text-muted-foreground italic pt-1">
                {tx.notes}
              </div>
            )}
            {!tx.isDecrypted && encryptionKey && (
               <p className="text-xs text-destructive">Decryption Failed</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">
              {typeof tx.amount === 'number' && typeof tx.price === 'number' ? formatUSD(tx.amount * tx.price) : '...'}
            </p>
            <p className="text-muted-foreground text-xs">
              @ {typeof tx.price === 'number' ? formatUSD(tx.price) : '...'}/BTC
            </p>
            <p className="text-muted-foreground text-xs">
              Fee: {typeof tx.fee === 'number' ? formatUSD(tx.fee) : '...'}
            </p>
            {tx.isDecrypted && (
              <div className="flex justify-end items-center space-x-1 mt-1">
                <CustomButton
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleEdit(tx)}
                  tooltip="Edit Transaction"
                  leftIcon={Pencil}
                />
                <CustomButton
                  variant="ghost"
                  size="sm"
                  color="destructive"
                  className="h-auto p-1"
                  onClick={() => handleDelete(tx.id)}
                  tooltip="Delete Transaction"
                  leftIcon={Trash2}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TransactionsPage() {
  const { openDialog: openAddTransactionDialog } = useDialog();
  const { mutate: mutateTransactions } = useSWR<Transaction[]>("/api/transactions");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <div className="flex items-center space-x-2">
          <CustomButton
            onClick={handleOpenImportModal}
            leftIcon={Upload}
            variant="outline"
            size="sm"
          >
            Import from File
          </CustomButton>
          <CustomButton
            onClick={handleAddTransaction}
            leftIcon={Plus}
            variant="filled"
            color="primary"
            size="sm"
          >
            Add Transaction
          </CustomButton>
        </div>
      </div>

      <TransactionList />

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
          </DialogHeader>
          
          <TransactionImporter
            onSuccess={handleImportComplete}
            onCancel={handleCloseImportModal}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
} 
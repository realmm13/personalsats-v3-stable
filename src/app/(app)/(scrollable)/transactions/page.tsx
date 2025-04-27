"use client";

import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, ArrowUpRight, ArrowDownRight, Trash2, Clock } from "lucide-react";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { useConfirmAlert } from "@/components/AlertContext";
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

type ProcessedTransaction = Transaction & {
  encryptedData?: string | null;
  isDecrypted?: boolean;
  decryptionError?: string | null;
};

function TransactionList() {
  const { data: rawTransactions, error: swrError, mutate } = useSWR<Transaction[]>("/api/transactions");
  const confirmAlert = useConfirmAlert();
  const { encryptionKey, isKeySet } = useEncryption();
  const [processedTransactions, setProcessedTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processAndDecrypt = async () => {
      if (!rawTransactions || !isKeySet || !encryptionKey) {
        setProcessedTransactions([]);
        return;
      }

      setIsProcessing(true);
      try {
        const results = await Promise.all(
          rawTransactions.map(async (tx): Promise<ProcessedTransaction> => {
            const timestamp = new Date(tx.timestamp);
            
            if (tx.encryptedData && encryptionKey) {
              try {
                const decryptedJson = await decryptString(tx.encryptedData, encryptionKey);
                const decryptedPayload = JSON.parse(decryptedJson);
                return {
                  ...tx,
                  ...decryptedPayload,
                  timestamp,
                  isDecrypted: true,
                  decryptionError: null,
                };
              } catch (decryptionError) {
                console.error(`Error decrypting transaction ${tx.id}:`, decryptionError);
                return {
                  ...tx,
                  timestamp,
                  type: 'buy',
                  amount: 0,
                  price: 0,
                  fee: 0,
                  wallet: 'N/A',
                  tags: [],
                  notes: 'Decryption Failed',
                  isDecrypted: false,
                  decryptionError: "Decryption failed",
                };
              }
            } else {
              return {
                ...tx,
                timestamp,
                isDecrypted: false,
                decryptionError: null,
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

  const handleDelete = async (id: string) => {
    const result = await confirmAlert({
      title: "Delete Transaction",
      description: "Are you sure you want to delete this transaction? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/transactions/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("Failed to delete transaction");
          }

          mutate();
        } catch (error) {
          console.error("Error deleting transaction:", error);
        }
      },
    });
  };

  if (!isKeySet) {
    return <PassphrasePrompt />;
  }

  if (swrError) return <div>Failed to load transactions data. Please try again.</div>;
  if (!rawTransactions) return <Spinner />;

  if (isProcessing) return <Spinner />;
  
  if (processedTransactions.length === 0 && !isProcessing) {
    return <div className="text-center text-muted-foreground py-8">No transactions found.</div>;
  }

  return (
    <div className="space-y-4">
      {processedTransactions.map((tx) => (
        <div
          key={tx.id}
          className={`flex items-start gap-4 rounded-lg border p-3 ${tx.decryptionError ? 'border-destructive bg-destructive/10' : 'bg-card'}`}
        >
          {tx.decryptionError ? (
            <div className="flex-1 text-destructive text-sm">
              <p className="font-medium">Error Processing Transaction</p>
              <p>Could not decrypt this transaction's details. The passphrase might be incorrect or the data corrupted.</p>
            </div>
          ) : (
            <>
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
                  {tx.type ? tx.type.charAt(0).toUpperCase() + tx.type.slice(1) : 'Unknown'} {tx.amount?.toFixed(8) ?? 'N/A'} BTC
                </p>
                <p className="text-muted-foreground text-xs">
                  {tx.timestamp instanceof Date && !isNaN(tx.timestamp.getTime()) ? format(tx.timestamp, 'MMM d, yyyy, h:mm a') : 'Invalid Date'}
                </p>
                {tx.wallet && (
                  <p className="text-muted-foreground text-xs">
                    Wallet: {tx.wallet}
                  </p>
                )}
                {tx.tags && tx.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tx.tags.map((tag) => (
                      <Badge key={tag} variant="outline" color="gray" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {tx.notes && (
                  <div className="text-sm text-muted-foreground italic pt-1">
                    {tx.notes}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {typeof tx.amount === 'number' && typeof tx.price === 'number' ? formatUSD(tx.amount * tx.price) : 'N/A'}
                </p>
                <p className="text-muted-foreground text-xs">
                  @ {typeof tx.price === 'number' ? formatUSD(tx.price) : 'N/A'}/BTC
                </p>
                <p className="text-muted-foreground text-xs">
                  Fee: {typeof tx.fee === 'number' ? formatUSD(tx.fee) : 'N/A'}
                </p>
                <CustomButton
                  variant="ghost"
                  size="sm"
                  color="destructive"
                  className="mt-1 h-auto p-1"
                  onClick={() => handleDelete(tx.id)}
                  tooltip="Delete Transaction"
                  leftIcon={Trash2}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TransactionsPage() {
  const { openDialog } = useDialog();
  const { mutate: mutateTransactions } = useSWR<Transaction[]>("/api/transactions");

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

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <CustomButton
          onClick={handleAddTransaction}
          leftIcon={Plus}
          variant="filled"
          color="primary"
        >
          Add Transaction
        </CustomButton>
      </div>

      <TransactionList />
    </div>
  );
} 
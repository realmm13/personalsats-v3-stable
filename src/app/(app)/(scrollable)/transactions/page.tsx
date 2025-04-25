"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { useConfirmAlert } from "@/components/AlertContext";
import { FormFieldSegmentedControl } from "@/components/FormFieldSegmentedControl";
import { Spinner } from "@/components/Spinner";
import { useDialog } from "@/components/DialogManager";
import useSWR from "swr";
import { type Transaction } from "@/lib/types";

const transactionFormSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: z.number().positive(),
  price: z.number().positive(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

function AddTransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "buy",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create transaction");
      }

      onSuccess();
    } catch (error) {
      console.error("Error creating transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormFieldSegmentedControl
        name="type"
        options={[
          { value: "buy", label: "Buy" },
          { value: "sell", label: "Sell" },
        ]}
      />
      
      <FormFieldInput
        name="amount"
        label="Amount (BTC)"
        type="number"
        placeholder="0.00"
      />

      <FormFieldInput
        name="price"
        label="Price (USD)"
        type="number"
        placeholder="0.00"
      />

      <FormFieldTextarea
        name="notes"
        label="Notes"
        placeholder="Add any notes about this transaction..."
      />

      <CustomButton
        type="submit"
        loading={isSubmitting}
        leftIcon={Plus}
      >
        Add Transaction
      </CustomButton>
    </form>
  );
}

function TransactionList() {
  const { data: transactions, error, mutate } = useSWR<Transaction[]>("/api/transactions");
  const confirmAlert = useConfirmAlert();

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

  if (error) return <div>Failed to load transactions</div>;
  if (!transactions) return <Spinner />;

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow"
        >
          <div className="flex items-center gap-4">
            {transaction.type === "buy" ? (
              <ArrowDownRight className="text-green-500" />
            ) : (
              <ArrowUpRight className="text-red-500" />
            )}
            <div>
              <div className="font-medium">
                {transaction.type === "buy" ? "Bought" : "Sold"} {transaction.amount} BTC
              </div>
              <div className="text-sm text-gray-500">
                at ${transaction.price.toLocaleString()} • {format(new Date(transaction.timestamp), "PPp")}
              </div>
              {transaction.notes && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {transaction.notes}
                </div>
              )}
            </div>
          </div>
          <CustomButton
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(transaction.id)}
            leftIcon={Trash2}
          />
        </div>
      ))}
    </div>
  );
}

export default function TransactionsPage() {
  const { openDialog } = useDialog();
  const { data: transactions, mutate } = useSWR<Transaction[]>("/api/transactions");

  const handleAddTransaction = () => {
    openDialog({
      title: "Add Transaction",
      component: AddTransactionForm,
      props: {
        onSuccess: () => {
          mutate();
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
        >
          Add Transaction
        </CustomButton>
      </div>

      <TransactionList />
    </div>
  );
} 
"use client";

import { useEffect } from "react";
import { useForm, FormProvider, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { FormFieldSegmentedControl } from "@/components/FormFieldSegmentedControl";
import { useEncryption } from "@/context/EncryptionContext";
import { encryptString } from "@/lib/encryption";
import { toast } from "sonner";
import type { Transaction } from "@/lib/types";
import { formatISO } from 'date-fns';

// Enforce all fields are present for editing, fee is optional but defaults
const editTransactionSchema = z.object({
  type: z.enum(["buy", "sell"]),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  amount: z.coerce.number().positive("Amount must be positive"),
  price: z.coerce.number().positive("Price must be positive"),
  fee: z.coerce.number().min(0, "Fee cannot be negative"),
  wallet: z.string().trim().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
});

type EditTransactionFormData = z.infer<typeof editTransactionSchema>;

interface EditTransactionFormProps {
  transaction: Transaction; // The transaction to edit
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditTransactionForm({ transaction, onSuccess, onCancel }: EditTransactionFormProps) {
  const { encryptionKey } = useEncryption();

  // Helper to format date for datetime-local input
  const formatDateTimeLocal = (date: string | Date | undefined): string => {
    if (!date) return formatISO(new Date()).slice(0, 16); // Default to now if no date
    try {
      return formatISO(new Date(date)).slice(0, 16);
    } catch {
      return formatISO(new Date()).slice(0, 16); // Fallback to now on error
    }
  };

  const methods = useForm<EditTransactionFormData>({
    resolver: zodResolver(editTransactionSchema),
    defaultValues: {
      type: transaction.type === "buy" || transaction.type === "sell" ? transaction.type : "buy",
      timestamp: formatDateTimeLocal(transaction.timestamp),
      amount: transaction.amount ?? 0,
      price: transaction.price ?? 0,
      fee: transaction.fee ?? 0,
      wallet: transaction.wallet ?? "",
      tags: Array.isArray(transaction.tags) ? transaction.tags.join(", ") : "",
      notes: transaction.notes ?? "",
    },
  });

  const onSubmit: SubmitHandler<EditTransactionFormData> = async (data) => {
    if (!encryptionKey) {
      toast.error("Encryption key not available. Cannot save changes.");
      return;
    }

    // Convert timestamp string back to Date object before encrypting/sending
    let timestampToSend: Date;
    try {
      timestampToSend = new Date(data.timestamp);
      if (isNaN(timestampToSend.getTime())) throw new Error("Invalid date input");
    } catch (e) {
      toast.error("Invalid date and time format.");
      return;
    }
    
    console.log("Submitting updated data:", data);
    console.log("Timestamp to send:", timestampToSend);

    try {
      const payloadToEncrypt = {
        type: data.type,
        amount: data.amount,
        price: data.price,
        fee: data.fee,
        wallet: data.wallet,
        tags: data.tags ? data.tags.split(",").map(tag => tag.trim()).filter(Boolean) : [],
        notes: data.notes,
      };

      const encryptedData = await encryptString(JSON.stringify(payloadToEncrypt), encryptionKey);

      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          encryptedData,
          timestamp: timestampToSend.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update transaction");
      }

      toast.success("Transaction updated successfully!");
      onSuccess?.();
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4">
        <FormFieldSegmentedControl
          name="type"
          label="Type"
          options={[
            { label: "Buy", value: "buy" },
            { label: "Sell", value: "sell" },
          ]}
        />

        <FormFieldInput 
          name="timestamp" 
          label="Date & Time" 
          type="datetime-local" 
        />

        <div className="grid grid-cols-2 gap-4">
          <FormFieldInput name="amount" label="Amount (BTC)" type="number" />
          <FormFieldInput name="price" label="Price per BTC (USD)" type="number" />
        </div>

        <FormFieldInput name="fee" label="Fee (USD)" type="number" />
        <FormFieldInput name="wallet" label="Wallet/Exchange" />
        <FormFieldInput name="tags" label="Tags" placeholder="Enter tags separated by commas" />
        <FormFieldTextarea name="notes" label="Notes" />

        <div className="flex justify-end space-x-2 pt-4">
          {onCancel && <CustomButton type="button" variant="outline" onClick={onCancel}>Cancel</CustomButton>}
          <CustomButton type="submit" loading={methods.formState.isSubmitting} color="primary">
            Save Changes
          </CustomButton>
        </div>
      </form>
    </FormProvider>
  );
} 
"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type z } from "zod";
import { Plus, X, Download, Bitcoin, Loader2 } from "lucide-react";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { FormFieldSegmentedControl } from "@/components/FormFieldSegmentedControl";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { transactionSchema } from "@/schemas/transaction-schema";
import { useBitcoinPrice } from "@/hooks/useBitcoinPrice";
import { formatUSD } from "@/lib/price";
import { FormFieldTags } from "@/components/FormFieldTags";
import { encryptString } from "@/lib/encryption";
import { useEncryption } from "@/context/EncryptionContext";
import { submitTransaction } from '@/services/transactionService';
import { encryptTx } from '@/lib/opensecret';

export type TransactionFormData = z.infer<typeof transactionSchema>;

interface AddTransactionFormProps {
  onSuccess: () => void;
}

export function AddTransactionForm({ onSuccess }: AddTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const {
    encryptionKey,
    isLoadingKey,
  } = useEncryption();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "buy",
      amount: 0,
      price: 0,
      fee: 0,
      timestamp: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      wallet: "",
      tags: [],
      notes: "",
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = form;

  const fetchCurrentPrice = async () => {
    setLoadingPrice(true);
    try {
      const response = await fetch("/api/price/current");
      if (!response.ok) throw new Error("Failed to fetch price");
      const data = await response.json();
      const priceNum = data.price?.usd;
      if (typeof priceNum === 'number') {
        setCurrentPrice(priceNum);
        setValue("price", priceNum, { shouldValidate: true });
      } else {
        throw new Error("Invalid price format received");
      }
    } catch (err) {
      console.error("Price fetch error:", err);
      setError(err instanceof Error ? err.message : "Could not fetch price");
    } finally {
      setLoadingPrice(false);
    }
  };

  const onSubmit = async (data: TransactionFormData) => {
    setLoading(true);
    setError(null);
    try {
      // Compose a Transaction object (add any required fields)
      const tx = {
        ...data,
        id: crypto.randomUUID(), // or another unique ID strategy
        userId: '', // Fill if needed, or let backend infer from session
        timestamp: new Date(data.timestamp).toISOString(),
      };
      if (!encryptionKey) {
        setError('Encryption key not set');
        setLoading(false);
        return;
      }
      const encryptedData = await encryptTx(tx, encryptionKey);
      console.log('🔑 encryptedData:', encryptedData);
      const payload = {
        id: tx.id,
        encryptedData,
        amount: tx.amount,
        date: tx.timestamp,
        price: tx.price,
        fee: tx.fee,
        wallet: tx.wallet,
        tags: tx.tags,
        notes: tx.notes,
      };
      console.log('🚀 payload:', payload);
      await submitTransaction(payload);
      onSuccess();
      form.reset();
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormFieldSegmentedControl
          name="type"
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        
        <FormFieldInput name="timestamp" label="Date & Time" type="datetime-local" />

        <div className="flex gap-4">
          <FormFieldInput name="amount" label="Amount (BTC)" type="number" className="flex-1" />
          <div className="flex-1">
            <FormFieldInput name="price" label="Price per BTC (USD)" type="number" />
            <CustomButton
              type="button"
              variant="ghost"
              color="primary"
              size="sm"
              className={`mt-1 px-0 h-auto text-white ${loadingPrice ? "animate-spin" : ""}`}
              onClick={fetchCurrentPrice}
              disabled={loadingPrice}
              leftIcon={loadingPrice ? Loader2 : Bitcoin}
            >
              {loadingPrice ? "Fetching..." : "Get Current Price"}
            </CustomButton>
          </div>
        </div>

        <FormFieldInput name="fee" label="Fee (USD)" type="number" />

        <FormFieldInput name="wallet" label="Wallet/Exchange" />

        <Controller
          name="tags"
          control={form.control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
              <FormFieldTags 
                value={field.value || []}
                onChange={field.onChange}
              />
            </div>
          )}
        />

        <FormFieldTextarea name="notes" label="Notes" />

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        <CustomButton 
          type="submit" 
          loading={loading || isLoadingKey}
          disabled={!encryptionKey || isLoadingKey || loading}
          color="primary" 
          className="w-full"
        >
          {isLoadingKey ? "Waiting for key..." : (loading ? "Saving..." : "Add Transaction")}
        </CustomButton>
      </form>
    </FormProvider>
  );
} 
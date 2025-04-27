"use client";

import { useState, useRef } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { generateEncryptionKey, encryptString } from "@/lib/encryption";
import { useEncryption } from "@/context/EncryptionContext";
import { PassphraseModal } from "@/components/PassphraseModal";

export type TransactionFormData = z.infer<typeof transactionSchema>;

interface AddTransactionFormProps {
  onSuccess: () => void;
}

export function AddTransactionForm({ onSuccess }: AddTransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const [passphraseModalOpen, setPassphraseModalOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<TransactionFormData | null>(null);

  const {
    encryptionKey,
    deriveAndSetKey,
    isLoadingKey,
    keyError,
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

  const actuallySubmitTransaction = async (data: TransactionFormData) => {
    if (!encryptionKey) {
      setError("Encryption key is not available. Cannot submit.");
      return;
    }

    console.log("Form Data (before encryption):", data);
    setLoading(true);
    setError(null);

    try {
      const payload = {
        type: data.type,
        amount: data.amount,
        price: data.price,
        fee: data.fee,
        wallet: data.wallet,
        tags: data.tags,
        notes: data.notes,
      };

      const encryptedData = await encryptString(JSON.stringify(payload), encryptionKey);

      const apiData = {
        timestamp: new Date(data.timestamp).toISOString(),
        encryptedData: encryptedData,
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add transaction");
      }
      onSuccess();
      form.reset();
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData: TransactionFormData) => {
    if (!encryptionKey) {
      setPendingFormData(formData);
      setPassphraseModalOpen(true);
      return;
    }
    await actuallySubmitTransaction(formData);
  };

  const handlePassphraseSubmit = async (passphrase: string) => {
    try {
      await deriveAndSetKey(passphrase);

      if (pendingFormData) {
        await actuallySubmitTransaction(pendingFormData);
        setPendingFormData(null);
      }
    } catch (error) {
      console.error("Failed to set encryption key:", error);
      setError(`Encryption Key Error: ${keyError || (error instanceof Error ? error.message : 'Failed to process passphrase.')}`);
    } finally {
      setPassphraseModalOpen(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
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

        <CustomButton type="submit" loading={loading || isLoadingKey} color="primary" className="w-full">
          {isLoadingKey ? "Deriving Key..." : (loading ? "Saving..." : "Add Transaction")}
        </CustomButton>
      </form>

      <PassphraseModal
        isOpen={passphraseModalOpen}
        onSubmit={handlePassphraseSubmit}
        onClose={() => setPassphraseModalOpen(false)}
      />
    </FormProvider>
  );
} 
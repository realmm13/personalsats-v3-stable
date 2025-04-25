"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Download } from "lucide-react";
import { FormFieldInput } from "@/components/FormFieldInput";
import { FormFieldTextarea } from "@/components/FormFieldTextarea";
import { CustomButton } from "@/components/CustomButton";
import { FormFieldSegmentedControl } from "@/components/FormFieldSegmentedControl";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const transactionFormSchema = z.object({
  type: z.enum(["buy", "sell"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:mm)"),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number",
  }),
  price: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Price must be a non-negative number",
  }),
  fee: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
    message: "Fee must be a non-negative number",
  }),
  wallet: z.string().min(1, "Wallet is required"),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

export function AddTransactionForm({ onSuccess }: { onSuccess: () => void }) { 
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: "buy",
      date: format(new Date(), "yyyy-MM-dd"),
      time: format(new Date(), "HH:mm"),
      amount: "",
      price: "",
      fee: "0",
      wallet: "",
      tags: [],
      notes: "",
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = form;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  const watchedTags = watch("tags") || [];

  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !watchedTags.includes(newTag)) {
      setValue("tags", [...watchedTags, newTag], { shouldValidate: true });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setValue("tags", watchedTags.filter(tag => tag !== tagToRemove), { shouldValidate: true });
  };

  const getCurrentPrice = async () => {
    setIsFetchingPrice(true);
    try {
      const res = await fetch("/api/price/current"); 
      if (!res.ok) throw new Error('Failed to fetch price');
      const data = await res.json();
      if (data.price?.usd) {
        setValue("price", data.price.usd.toFixed(2), { shouldValidate: true }); 
      }
    } catch (error) {
      console.error("Failed to get current price:", error);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const onSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    try {
      const timestamp = new Date(`${data.date}T${data.time}:00`);
      const payload = {
        type: data.type,
        amount: parseFloat(data.amount),
        price: parseFloat(data.price),
        fee: parseFloat(data.fee),
        timestamp: timestamp.toISOString(),
        wallet: data.wallet,
        tags: data.tags,
        notes: data.notes,
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create transaction");
      }

      onSuccess();
    } catch (error) {
      console.error("Error creating transaction:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormFieldSegmentedControl
          name="type"
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormFieldInput name="date" label="Date" type="date" />
          <FormFieldInput name="time" label="Time" type="time" />
        </div>

        <FormFieldInput
          name="amount"
          label="Amount (BTC)"
          type="number"
          placeholder="0.00000000"
        />

        <div className="flex items-end gap-2">
          <FormFieldInput 
            name="price" 
            label="Price (USD)" 
            type="number" 
            placeholder="0.00" 
            className="flex-grow"
          />
          <CustomButton 
            type="button" 
            variant="filled"
            onClick={getCurrentPrice}
            loading={isFetchingPrice}
            leftIcon={Download}
            size="sm"
            className="shrink-0 mb-[2px]"
          >
            Get Current
          </CustomButton>
        </div>

        <FormFieldInput 
          name="fee" 
          label="Fee (BTC)" 
          type="number" 
          placeholder="0.00000000" 
        />

        <FormFieldInput 
          name="wallet" 
          label="Wallet" 
          type="text" 
          placeholder="e.g., Ledger, Exchange" 
        />

        <div>
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block mb-2">Tags</label>
          <div className="flex items-center gap-2 mb-2">
            <Input 
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add a tag..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
            />
            <CustomButton type="button" variant="filled" onClick={handleAddTag} size="sm">Add</CustomButton>
          </div>
          <div className="flex flex-wrap gap-1">
            {watchedTags.map((tag) => (
              <Badge key={tag} variant="default" color="gray" className="cursor-pointer">
                {tag}
                <X 
                  className="ml-1 h-3 w-3"
                  onClick={() => handleRemoveTag(tag)}
                />
              </Badge>
            ))}
          </div>
          <input type="hidden" {...register("tags")} /> 
        </div>

        <FormFieldTextarea
          name="notes"
          label="Notes"
          placeholder="Add any notes about this transaction..."
        />

        <CustomButton
          type="submit"
          loading={isSubmitting}
          leftIcon={Plus}
          className="w-full"
        >
          Add Transaction
        </CustomButton>
      </form>
    </FormProvider>
  );
} 
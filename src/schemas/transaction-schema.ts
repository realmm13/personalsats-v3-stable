// src/schemas/transaction-schema.ts
import { z } from "zod";

// Schema for the plaintext transaction data
export const transactionSchema = z.object({
  type: z.enum(["buy", "sell", "deposit", "withdrawal", "interest"]),
  amount: z.coerce.number().positive("Amount must be positive"), // Use coerce for form data
  price: z.coerce.number().gte(0, "Price must be non-negative"), // Use coerce for form data
  fee: z.coerce.number().gte(0, "Fee must be non-negative").optional(), // Optional, use coerce
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date/time format (e.g., YYYY-MM-DDTHH:mm)",
  }), // Expect combined datetime string
  wallet: z.string().optional(), // Optional
  tags: z.array(z.string()).optional(), // Optional
  notes: z.string().optional(), // Optional
});

// Type for form data or already validated plaintext data
export type TransactionFormData = z.infer<typeof transactionSchema>; 
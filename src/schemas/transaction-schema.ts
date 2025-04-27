// src/schemas/transaction-schema.ts
import { z } from "zod";

// Update schema based on image
export const transactionSchema = z.object({
  type: z.enum(["buy", "sell"]),
  amount: z.number().positive("Amount must be positive"),
  price: z.number().gte(0, "Price must be non-negative"),
  fee: z.number().gte(0, "Fee must be non-negative").optional(), // Optional
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date/time format (YYYY-MM-DDTHH:mm)",
  }), // Expect combined datetime string
  wallet: z.string().optional(), // Optional
  tags: z.array(z.string()).optional(), // Optional
  notes: z.string().optional(), // Optional
});

export type TransactionFormData = z.infer<typeof transactionSchema>; 
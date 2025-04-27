"use client";

import { useState } from "react";
import { useEncryption } from "@/context/EncryptionContext";
import { Input } from "@/components/ui/input";
import { CustomButton } from "@/components/CustomButton";
import { Loader2 } from "lucide-react";

export function PassphrasePrompt() {
  const { deriveAndSetKey, isLoadingKey, keyError } = useEncryption();
  const [passphrase, setPassphrase] = useState("");

  const handleSubmit = async () => {
    if (!passphrase) return;
    await deriveAndSetKey(passphrase);
  };

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto mt-10 p-6 border rounded-lg bg-card text-card-foreground shadow-md">
      <h2 className="text-xl font-semibold text-center">Enter Passphrase to Decrypt Transactions</h2>
      <p className="text-sm text-muted-foreground text-center">
        Your transaction details are encrypted. Please enter the passphrase you used when adding transactions.
      </p>
      <Input
        type="password"
        placeholder="Enter passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        disabled={isLoadingKey}
      />
      <CustomButton 
        onClick={handleSubmit} 
        loading={isLoadingKey}
        disabled={isLoadingKey || !passphrase}
        leftIcon={isLoadingKey ? Loader2 : undefined}
        color="primary"
      >
        {isLoadingKey ? "Deriving Key..." : "Unlock Transactions"}
      </CustomButton>
      {keyError && <p className="text-sm text-red-600 text-center">Error: {keyError}</p>}
    </div>
  );
} 
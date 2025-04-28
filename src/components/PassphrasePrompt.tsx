"use client";

import { useState } from "react";
import { useEncryption } from "@/context/EncryptionContext";
import { Input } from "@/components/ui/input";
import { CustomButton } from "@/components/CustomButton";
import { Loader2 } from "lucide-react";
import { generateEncryptionKey, decryptString } from "@/lib/encryption";
import { toast } from "sonner";

interface PassphrasePromptProps {
  sampleEncryptedData?: string | null;
}

export function PassphrasePrompt({ sampleEncryptedData }: PassphrasePromptProps) {
  const { setEncryptionKey, isLoadingKey, keyError } = useEncryption();
  const [passphrase, setPassphrase] = useState("");
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!passphrase) return;
    setIsTestingKey(true);
    setLocalError(null);

    try {
      const potentialKey = await generateEncryptionKey(passphrase);

      console.log("Skipping test decryption, setting key directly...");
      setEncryptionKey(potentialKey);

    } catch (error) {
      console.error("Error generating key:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to process passphrase.";
      toast.error(`Key generation failed: ${errorMsg}`);
      setLocalError(errorMsg);
    } finally {
      setIsTestingKey(false);
    }
  };

  const currentLoading = isLoadingKey || isTestingKey;
  const currentError = localError || keyError;

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto mt-10 p-6 border rounded-lg bg-card text-card-foreground shadow-md">
      <h2 className="text-xl font-semibold text-center">Enter Passphrase to Decrypt Transactions</h2>
      <p className="text-sm text-muted-foreground text-center">
        Your transaction details are encrypted. Please enter the passphrase you used.
      </p>
      <Input
        type="password"
        placeholder="Enter passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        disabled={currentLoading}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <CustomButton 
        onClick={handleSubmit} 
        loading={currentLoading}
        disabled={currentLoading || !passphrase}
        leftIcon={currentLoading ? Loader2 : undefined}
        color="primary"
      >
        {currentLoading ? "Verifying..." : "Unlock Transactions"}
      </CustomButton>
      {currentError && <p className="text-sm text-red-600 text-center">Error: {currentError}</p>}
    </div>
  );
} 
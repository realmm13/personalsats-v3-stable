"use client"; // Context needs to be client-side

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useEncryption } from '@/context/EncryptionContext'; // Import useEncryption
import { toast } from 'sonner'; // For feedback

interface PassphraseContextValue {
  isUnlocked: boolean;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
}

const PassphraseContext = createContext<PassphraseContextValue | undefined>(undefined);

// No longer need sample data or direct crypto here
// import { generateEncryptionKey, decryptString } from '@/lib/encryption'; 
// const sampleEncryptedData = process.env.NEXT_PUBLIC_SAMPLE_ENCRYPTED_DATA;

export function PassphraseProvider({ children }: { children: ReactNode }) {
  const [isUnlockedInternal, setUnlockedInternal] = useState(false);
  const { 
    deriveAndSetKey, 
    clearEncryptionKey, 
    isKeySet: isEncryptionKeySet, // Get key status from EncryptionProvider
    keyError // Get potential key error
  } = useEncryption();

  // Sync internal state if encryption key is already set (e.g., from session storage)
  React.useEffect(() => {
    if (isEncryptionKeySet) {
      setUnlockedInternal(true);
    }
  }, [isEncryptionKeySet]);

  const unlock = useCallback(async (passphrase: string): Promise<boolean> => {
    if (!passphrase) {
        toast.error("Passphrase cannot be empty.");
        return false;
    }

    try {
      // Use deriveAndSetKey for validation AND setting the key
      const success = await deriveAndSetKey(passphrase);
      
      if (success) {
        setUnlockedInternal(true);
        toast.success("Session unlocked.");
        return true;
      } else {
        // deriveAndSetKey handles its own errors/toasts generally, but we ensure locked state
        setUnlockedInternal(false);
        // Use the keyError from EncryptionContext if available
        // toast.error(keyError || "Incorrect passphrase."); // Modal usually shows error
        return false;
      }
    } catch (error) {
      // Catch any unexpected errors during the process
      console.error("Error during unlock process:", error);
      setUnlockedInternal(false);
      toast.error("An unexpected error occurred during unlock.");
      return false;
    }
  }, [deriveAndSetKey]);

  const lock = useCallback(() => {
    clearEncryptionKey(); // Clear the key in EncryptionProvider
    setUnlockedInternal(false);
    toast.info("Session locked.");
  }, [clearEncryptionKey]);

  return (
    // Provide the internally managed isUnlocked state
    <PassphraseContext.Provider value={{ isUnlocked: isUnlockedInternal, unlock, lock }}>
      {children}
    </PassphraseContext.Provider>
  );
}

export function usePassphrase() {
  const ctx = useContext(PassphraseContext);
  if (!ctx) throw new Error('usePassphrase must be used within PassphraseProvider');
  return ctx;
} 
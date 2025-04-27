"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { generateEncryptionKey } from "@/lib/encryption";

type EncryptionContextType = {
  encryptionKey: CryptoKey | null;
  setEncryptionKey: (key: CryptoKey | null) => void;
  deriveAndSetKey: (passphrase: string) => Promise<void>;
  isKeySet: boolean;
  isLoadingKey: boolean;
  keyError: string | null;
};

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
};

export const EncryptionProvider = ({ children }: { children: ReactNode }) => {
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const deriveAndSetKey = useCallback(async (passphrase: string) => {
    setIsLoadingKey(true);
    setKeyError(null);
    try {
      if (!passphrase) {
        throw new Error("Passphrase cannot be empty.");
      }
      const key = await generateEncryptionKey(passphrase);
      setEncryptionKey(key);
    } catch (error) {
      console.error("Error deriving encryption key:", error);
      setKeyError(error instanceof Error ? error.message : "Failed to derive key.");
      setEncryptionKey(null); // Clear any previous key on error
    } finally {
      setIsLoadingKey(false);
    }
  }, []);

  const value: EncryptionContextType = {
    encryptionKey,
    setEncryptionKey: (key: CryptoKey | null) => {
      setEncryptionKey(key);
      setKeyError(null); // Clear error when key is manually set/cleared
    },
    deriveAndSetKey,
    isKeySet: !!encryptionKey,
    isLoadingKey,
    keyError,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}; 
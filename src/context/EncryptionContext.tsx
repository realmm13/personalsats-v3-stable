"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { generateEncryptionKey } from "@/lib/encryption"; // Keep key generation logic

// Helper functions for base64 conversion (browser-safe)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const byte = bytes[i];
    // Ensure byte is a valid number before using
    if (typeof byte === 'number') {
        binary += String.fromCharCode(byte);
    } else {
        console.warn(`Invalid byte encountered at index ${i}`);
    }
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const charCode = binary_string.charCodeAt(i);
    // Ensure charCode is a valid number before assigning
    if (typeof charCode === 'number') {
        bytes[i] = charCode;
    } else {
        console.warn(`Invalid charCode encountered at index ${i}`);
    }
  }
  return bytes.buffer;
}

// Context type exposing CryptoKey and original states/functions
type EncryptionContextType = {
  encryptionKey: CryptoKey | null;
  setEncryptionKey: (key: CryptoKey | null) => void; // Allow direct setting/clearing
  deriveAndSetKey: (passphrase: string) => Promise<boolean>; // Return success boolean
  isKeySet: boolean;
  isLoadingKey: boolean;
  keyError: string | null;
  clearEncryptionKey: () => void; // Add clear function
  encryptionPhrase: string | null;
};

const EncryptionContext = createContext<EncryptionContextType | undefined>({
  encryptionKey: null,
  setEncryptionKey: () => {},
  deriveAndSetKey: async () => false,
  isKeySet: false,
  isLoadingKey: false,
  keyError: null,
  clearEncryptionKey: () => {},
  encryptionPhrase: null,
});

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
};

export const EncryptionProvider = ({ children }: { children: ReactNode }) => {
  const [encryptionKey, setEncryptionKeyState] = useState<CryptoKey | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true); // Start loading until checked
  const [keyError, setKeyError] = useState<string | null>(null);
  const [encryptionPhrase, setEncryptionPhrase] = useState<string | null>(null);

  // Function to set the key (state only, no sessionStorage persistence)
  const setKeyAndPersist = useCallback(async (key: CryptoKey | null) => {
    setEncryptionKeyState(key);
    setKeyError(null);
    setIsLoadingKey(false);
    // No longer persist the CryptoKey to sessionStorage
  }, []);

  // Updated deriveAndSetKey to use the persisting setter and return success
  const deriveAndSetKey = useCallback(
    async (passphrase: string): Promise<boolean> => {
      console.log("[EncryptionProvider] Attempting deriveAndSetKey...");
      setIsLoadingKey(true);
      setKeyError(null);
      try {
        if (!passphrase) {
          throw new Error("Passphrase cannot be empty.");
        }

        // 1) Load or generate salt from localStorage
        let saltB64 = localStorage.getItem("encryptionSalt");
        let salt: Uint8Array;
        if (saltB64) {
          salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
          console.log("[EncryptionProvider] Loaded existing salt from localStorage.");
        } else {
          salt = crypto.getRandomValues(new Uint8Array(16));
          localStorage.setItem("encryptionSalt", btoa(String.fromCharCode(...salt)));
          console.log("[EncryptionProvider] Generated and saved new salt to localStorage.");
        }

        // Persist the raw passphrase to sessionStorage (keeps session-specific unlock)
        sessionStorage.setItem("encryptionPhrase", passphrase);
        console.log('🔑 passphrase saved →', sessionStorage.getItem('encryptionPhrase'));

        // 2) Derive the key using the loaded/generated salt
        console.log("[EncryptionProvider] Generating key with persisted salt...");
        const key = await generateEncryptionKey(passphrase, salt);
        console.log("[EncryptionProvider] Key generated.");

        // Fingerprint the key (optional, but good for debugging)
        try {
          const raw = await crypto.subtle.exportKey('raw', key);
          const fingerprint = btoa(String.fromCharCode(...new Uint8Array(raw))).slice(0, 16);
          console.log('🔑 derived key fingerprint (first 16 chars):', fingerprint);
        } catch (fpError) {
          console.error("Error fingerprinting key:", fpError);
        }

        await setKeyAndPersist(key); // Only set in React state
        setEncryptionPhrase(passphrase); // Store the passphrase in state
        console.log("[EncryptionProvider] deriveAndSetKey succeeded.");
        return true;
      } catch (error) {
        console.error("[EncryptionProvider] Error in deriveAndSetKey:", error);
        setKeyError(
          error instanceof Error ? error.message : "Failed to derive key.",
        );
        await setKeyAndPersist(null); // Clear key state on error
        setEncryptionPhrase(null);
        console.log("[EncryptionProvider] deriveAndSetKey failed.");
        return false;
      }
    },
    [setKeyAndPersist],
  );

  // Load key from sessionStorage on initial mount, but only if a passphrase is present
  useEffect(() => {
    setIsLoadingKey(true);
    setKeyError(null);
    try {
      const savedPhrase = sessionStorage.getItem("encryptionPhrase");
      console.log('[EncryptionProvider] loaded phrase from storage:', savedPhrase);
      if (savedPhrase) {
        // Only derive if we actually have something saved
        console.log("Found encryption phrase in sessionStorage. Deriving key...");
        deriveAndSetKey(savedPhrase)
          .then((success) => {
            if (!success) {
              console.error("Failed to derive key from saved phrase");
              sessionStorage.removeItem("encryptionPhrase"); // Clear corrupted phrase
            }
          })
          .finally(() => {
            setIsLoadingKey(false);
          });
      } else {
        // No phrase found, just mark loading as false so UI can show PassphraseModal
        setEncryptionKeyState(null);
        setIsLoadingKey(false);
      }
    } catch (error) {
      console.error("Error accessing sessionStorage:", error);
      setKeyError("Failed to access saved phrase.");
      setEncryptionKeyState(null);
      setIsLoadingKey(false);
    }
  }, []);

  // Effect for clearing key from sessionStorage on tab/window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("[EncryptionProvider] Clearing key from sessionStorage on unload.");
      sessionStorage.removeItem("encryptionKey");
      sessionStorage.removeItem("encryptionPhrase");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const clearEncryptionKey = useCallback(() => {
    console.log("[EncryptionProvider] Explicitly clearing encryption key."); // Add log
    setKeyAndPersist(null); // Use the setter to clear state and storage
    setEncryptionPhrase(null);
  }, [setKeyAndPersist]);

  const value: EncryptionContextType = {
    encryptionKey,
    setEncryptionKey: setKeyAndPersist, // Expose the persisting setter
    deriveAndSetKey,
    isKeySet: !!encryptionKey,
    isLoadingKey,
    keyError,
    clearEncryptionKey,
    encryptionPhrase,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}; 
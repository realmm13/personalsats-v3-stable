"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from "react";
import { generateEncryptionKey } from "@/lib/encryption"; // Keep key generation logic
import { useCurrentUser } from '@/hooks/useCurrentUser';
import api from '@/api'; // Assuming you have a default export for API calls

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
  const { user } = useCurrentUser();
  const [encryptionKey, setEncryptionKeyState] = useState<CryptoKey | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true); // Start loading until checked
  const [keyError, setKeyError] = useState<string | null>(null);
  const [encryptionPhrase, setEncryptionPhrase] = useState<string | null>(null);

  // Function to set the key (state only, no sessionStorage persistence)
  const setKeyAndPersist = useCallback(async (key: CryptoKey | null) => {
    setEncryptionKeyState(key);
    setKeyError(null);
    setIsLoadingKey(false);
  }, []);

  // Updated deriveAndSetKey to use the user's encryptionSalt from the server
  const deriveAndSetKey = useCallback(
    async (passphrase: string): Promise<boolean> => {
      setIsLoadingKey(true);
      setKeyError(null);
      try {
        if (!passphrase) {
          throw new Error("Passphrase cannot be empty.");
        }
        if (!user) {
          throw new Error("deriveAndSetKey: no authenticated user");
        }
        let salt: Uint8Array;
        let saltHex: string = typeof user?.encryptionSalt === 'string' ? user.encryptionSalt : '';
        console.log('[EncryptionContext] Using salt:', saltHex, 'and passphrase:', passphrase);
        if (!saltHex) {
          // Generate salt, POST to /api/user/setSalt, and use it
          const generatedSalt = crypto.getRandomValues(new Uint8Array(16));
          saltHex = Array.from(generatedSalt).map((b: number) => b.toString(16).padStart(2, '0')).join('');
          await api.post('/api/user/setSalt', { salt: saltHex });
          salt = generatedSalt;
        } else {
          // Convert hex string to Uint8Array
          const matches: RegExpMatchArray | null = saltHex.match(/.{1,2}/g);
          salt = matches ? new Uint8Array(matches.map((byte: string) => parseInt(byte, 16))) : new Uint8Array();
        }
        sessionStorage.setItem("encryptionPhrase", passphrase);
        const key = await generateEncryptionKey(passphrase, salt);
        await setKeyAndPersist(key);
        setEncryptionPhrase(passphrase);
        console.log('[EncryptionContext] deriveAndSetKey -> success');
        return true;
      } catch (error) {
        setKeyError(error instanceof Error ? error.message : "Failed to derive key.");
        await setKeyAndPersist(null);
        setEncryptionPhrase(null);
        console.error('[EncryptionContext] deriveAndSetKey -> failed', error);
        return false;
      }
    },
    [setKeyAndPersist, user],
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
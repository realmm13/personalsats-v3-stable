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
};

const EncryptionContext = createContext<EncryptionContextType | undefined>(
  undefined,
);

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

  // Load key from sessionStorage on initial mount
  useEffect(() => {
    setIsLoadingKey(true);
    setKeyError(null);
    try {
      const savedKeyBase64 = sessionStorage.getItem("encryptionKey");
      if (savedKeyBase64) {
        console.log("Found encryption key in sessionStorage. Importing...");
        const keyBuffer = base64ToArrayBuffer(savedKeyBase64);
        // Import the raw key back into a CryptoKey
        crypto.subtle
          .importKey(
            "raw",
            keyBuffer,
            { name: "AES-GCM", length: 256 },
            true, // Set extractable to true
            ["encrypt", "decrypt"],
          )
          .then((importedKey) => {
            setEncryptionKeyState(importedKey);
            console.log("Encryption key imported successfully.");
          })
          .catch((err) => {
            console.error("Failed to import key from sessionStorage:", err);
            setKeyError("Failed to load saved key. It might be corrupted.");
            sessionStorage.removeItem("encryptionKey"); // Clear corrupted key
            setEncryptionKeyState(null);
          })
          .finally(() => {
            setIsLoadingKey(false);
          });
      } else {
        // No key found
        setEncryptionKeyState(null);
        setIsLoadingKey(false);
      }
    } catch (error) {
        console.error("Error accessing sessionStorage or decoding key:", error);
        setKeyError("Failed to access saved key.");
        setEncryptionKeyState(null);
        setIsLoadingKey(false);
    }
  }, []);

  // Effect for clearing key from sessionStorage on tab/window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      console.log("[EncryptionProvider] Clearing key from sessionStorage on unload.");
      sessionStorage.removeItem("encryptionKey");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function to remove the listener when the component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty dependency array: Setup/cleanup once on mount

  // Function to set the key (state + sessionStorage)
  const setKeyAndPersist = useCallback(async (key: CryptoKey | null) => {
    setEncryptionKeyState(key);
    setKeyError(null);
    setIsLoadingKey(false);

    if (key) {
      try {
        // Export key to raw ArrayBuffer
        const exportedKeyBuffer = await crypto.subtle.exportKey("raw", key);
        // Convert ArrayBuffer to base64 string
        const keyBase64 = arrayBufferToBase64(exportedKeyBuffer);
        // Save base64 string to sessionStorage
        sessionStorage.setItem("encryptionKey", keyBase64);
        console.log("Encryption key saved to sessionStorage.");
      } catch (error) {
        console.error("Failed to export and save encryption key:", error);
        setKeyError("Failed to persist encryption key.");
        // Should we clear the key state if persistence fails?
        // setEncryptionKeyState(null);
      }
    } else {
      // If key is null, clear from sessionStorage
      sessionStorage.removeItem("encryptionKey");
      console.log("Encryption key cleared from sessionStorage.");
    }
  }, []);

  // Updated deriveAndSetKey to use the persisting setter and return success
  const deriveAndSetKey = useCallback(
    async (passphrase: string): Promise<boolean> => {
      console.log("[EncryptionProvider] Attempting deriveAndSetKey..."); // Log entry
      setIsLoadingKey(true);
      setKeyError(null);
      try {
        if (!passphrase) {
          throw new Error("Passphrase cannot be empty.");
        }
        console.log("[EncryptionProvider] Generating key..."); // Log before generation
        const key = await generateEncryptionKey(passphrase);
        console.log("[EncryptionProvider] Key generated, attempting persist:", key); // Log generated key
        await setKeyAndPersist(key); // Use the setter that also saves
        console.log("[EncryptionProvider] deriveAndSetKey succeeded."); // Log success
        return true; // Indicate success
      } catch (error) {
        console.error("[EncryptionProvider] Error in deriveAndSetKey:", error); // Log specific error
        setKeyError(
          error instanceof Error ? error.message : "Failed to derive key.",
        );
        await setKeyAndPersist(null); // Clear key state and storage on error
        console.log("[EncryptionProvider] deriveAndSetKey failed."); // Log failure
        return false; // Indicate failure
      }
    },
    [setKeyAndPersist],
  );

  const clearEncryptionKey = useCallback(() => {
    console.log("[EncryptionProvider] Explicitly clearing encryption key."); // Add log
    setKeyAndPersist(null); // Use the setter to clear state and storage
  }, [setKeyAndPersist]);

  const value: EncryptionContextType = {
    encryptionKey,
    setEncryptionKey: setKeyAndPersist, // Expose the persisting setter
    deriveAndSetKey,
    isKeySet: !!encryptionKey,
    isLoadingKey,
    keyError,
    clearEncryptionKey,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}; 
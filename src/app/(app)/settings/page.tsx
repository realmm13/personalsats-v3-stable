"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Spinner } from "@/components/Spinner";

export default function SettingsPage() {
  // Fetch only encryption phrase status
  const { data, isLoading, error: loadingError } = api.userSettings.get.useQuery();
  const updateSettings = api.userSettings.update.useMutation();

  // Local state only for the NEW passphrase input
  const [newPassphrase, setNewPassphrase] = useState<string>("");

  const onSave = () => {
    // Only submit if a new passphrase has been entered
    if (!newPassphrase) {
      toast.info("Please enter a new passphrase to save.");
      return;
    }

    const inputData = { encryptionPhrase: newPassphrase };

    updateSettings.mutate(inputData, {
      onSuccess: () => {
        toast.success("Encryption Passphrase updated!");
        setNewPassphrase("");
        // Consider invalidating query if status text needs to update immediately
        // api.useUtils().userSettings.get.invalidate();
      },
      onError: (err: Error) => {
        toast.error(`Error saving passphrase: ${err.message}`);
      },
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center gap-2 p-6">
      <Spinner size="lg" />
      <span>Loading settings status...</span>
    </div>
  );
  if (loadingError) return <div className="p-6 text-red-500">Error loading settings status: {loadingError.message}</div>;

  return (
    <div className="max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold">Security Settings</h1>

      {/* Encryption Passphrase Section */}
      <div className="space-y-1">
        <Label htmlFor="newPassphrase">Encryption Passphrase</Label>
        <Input
          id="newPassphrase"
          type="password"
          placeholder="Enter new passphrase to set or change"
          value={newPassphrase}
          onChange={(e) => setNewPassphrase(e.currentTarget.value)}
        />
        {data?.encryptionPhrase ? (
          <p className="text-sm text-green-600">
            An encryption passphrase is currently set.
          </p>
        ) : (
          <p className="text-sm text-yellow-600">
            No passphrase set. Required for CSV imports.
          </p>
        )}
         <p className="text-xs text-muted-foreground">
            Enter a new passphrase here to set or update it.
          </p>
      </div>

      <Button 
        onClick={onSave}
        disabled={updateSettings.isPending || !newPassphrase}
      >
        {updateSettings.isPending ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Saving…
          </>
        ) : (
          "Save New Passphrase"
        )}
      </Button>
    </div>
  );
} 
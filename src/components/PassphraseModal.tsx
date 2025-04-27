"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner"; // or your toast library

interface PassphraseModalProps {
  isOpen: boolean;
  onSubmit: (passphrase: string) => void;
  onClose: () => void;
}

export function PassphraseModal({ isOpen, onSubmit, onClose }: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState("");

  const handleSubmit = () => {
    if (passphrase.trim()) {
      onSubmit(passphrase);
      setPassphrase("");
    }
  };

  const handleForgotPassphrase = () => {
    onClose(); // Close the modal
    toast.warning("🔒 Your passphrase is not recoverable. You'll need to reset your vault to start fresh.");
    // Optional future: trigger a full "reset vault" flow
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="space-y-6">
        <DialogHeader>
          <DialogTitle>Enter Your Encryption Passphrase</DialogTitle>
        </DialogHeader>
        <Input
          type="password"
          placeholder="Enter your passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <DialogFooter className="flex flex-col gap-2">
          <Button onClick={handleSubmit} className="w-full">
            Submit
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleForgotPassphrase}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Forgot your passphrase?
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
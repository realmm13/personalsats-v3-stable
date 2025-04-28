"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"; // Adjust import if you use a different Dialog
import { Button } from "@/components/ui/button"; // Adjust Button import if needed

export function PassphraseGuideModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("seenPassphraseGuide");
    if (!hasSeenGuide) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("seenPassphraseGuide", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔒 Your Passphrase Protects Your Privacy</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <p>✅ Only you know your passphrase. We can't see or recover it.</p>
          <p>✅ Enter it once per session while your tab is open.</p>
          <p>✅ Your passphrase unlocks your encrypted transactions across devices.</p>
          <p>✅ Secure your passphrase — losing it means losing access to your history.</p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>Got it!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
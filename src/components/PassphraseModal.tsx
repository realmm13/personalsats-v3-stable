"use client";

import React, { useState } from 'react';
import { usePassphrase } from '@/lib/passphraseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function PassphraseModal() {
  const { unlock } = usePassphrase();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    const success = await unlock(input);
    if (!success) {
      setError('Incorrect passphrase. Please try again.');
      toast.error("Incorrect passphrase.");
    } else {
      setInput('');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <form 
        onSubmit={handleSubmit}
        className="bg-card text-card-foreground rounded-lg p-6 shadow-xl border w-full max-w-sm"
      >
        <h2 className="text-lg font-semibold mb-4">
          Unlock Session
        </h2>
        <div className="space-y-4">
            <Label htmlFor="passphrase-input" className="sr-only">
                Enter your passphrase
            </Label>
            <Input
              id="passphrase-input"
              type="password"
              placeholder="••••••••"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              required
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Unlock'}
            </Button>
        </div>
      </form>
    </div>
  );
} 
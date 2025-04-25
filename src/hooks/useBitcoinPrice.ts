"use client"; // Mark as client component

import { useState, useEffect } from 'react';
import { clientEnv } from '@/env/client';
import { getBitcoinPrice } from '@/lib/price'; // Import the server utility

// React hook for live price updates (Moved from lib/price.ts)
export function useBitcoinPrice(updateInterval = clientEnv.NEXT_PUBLIC_PRICE_UPDATE_INTERVAL) {
  const [price, setPrice] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const updatePrice = async () => {
      try {
        // Call the utility function (ensuring it returns a number)
        const newPrice = await getBitcoinPrice(false) as number; 
        if (mounted) {
          setPrice(newPrice);
          setLastUpdated(new Date());
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch price');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    updatePrice();
    const interval = setInterval(updatePrice, updateInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [updateInterval]);

  return { price, lastUpdated, loading, error };
} 
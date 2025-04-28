"use client";

import { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button'; // Use Shadcn Button
import { Input } from '@/components/ui/input';   // Use Shadcn Input
import { Label } from '@/components/ui/label';   // Use Shadcn Label
import { Spinner } from '@/components/Spinner'; // Use existing Spinner
import { toast } from 'sonner';
import { processStrikeCsv } from '@/lib/importAdapters/strike'; 
// Import encryption hooks and utils
import { useEncryption } from "@/context/EncryptionContext";
import { encryptString } from "@/lib/encryption";
import type { Transaction } from "@/lib/types"; // Import Transaction type

// Define the structure we expect from the adapter
interface ProcessedImport {
  data?: Partial<Transaction>; 
  error?: string;
  skipped?: boolean;
  reason?: string; 
  needsReview?: boolean;
  needsPrice?: boolean; 
  sourceRow: Record<string, any>; // Keep source row generic for now
}

// Define the payload structure to send to the bulk API
interface BulkApiPayloadItem {
    timestamp: string; // ISO string
    tags?: string[];
    asset: string;
    priceAsset?: string;
    feeAsset?: string;
    exchangeTxId?: string | null;
    encryptedData: string;
}

export function TransactionImporter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRowCount, setParsedRowCount] = useState<number | null>(null);
  const [processedRowCount, setProcessedRowCount] = useState<number | null>(null);
  const [importResults, setImportResults] = useState<{success: number, skipped: number, errors: number, review: number} | null>(null);

  // Get encryption key
  const { encryptionKey, isKeySet } = useEncryption();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      // Basic check for CSV type (can be enhanced)
      if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
        toast.error("Please select a valid CSV file.");
        setSelectedFile(null);
        event.target.value = ''; // Reset file input
      } else {
        setSelectedFile(file);
        setParsedRowCount(null); // Reset count when file changes
        setProcessedRowCount(null);
        setImportResults(null);
      }
    } else {
      setSelectedFile(null);
      setParsedRowCount(null);
      setProcessedRowCount(null);
      setImportResults(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) {
      toast.error("Please select a file first.");
      return;
    }
    if (!isKeySet || !encryptionKey) {
        toast.error("Encryption key not available. Please ensure your passphrase is set.");
        return;
    }

    setIsLoading(true);
    setParsedRowCount(null);
    setProcessedRowCount(null);
    setImportResults(null);
    console.log(`Starting parse for file: ${selectedFile.name}`);

    // --- TODO: Implement Adapter Detection Logic --- 
    // For now, assume it's a Strike file
    const adapter = processStrikeCsv; // Hardcode Strike adapter for now
    // --------------------------------------------

    Papa.parse<Record<string, any>>(selectedFile, {
      header: true,         
      skipEmptyLines: true, 
      dynamicTyping: true,  
      complete: async (results) => {
        if (results.errors.length > 0) {
          setIsLoading(false);
          console.error('Parsing errors:', results.errors);
          toast.error(`Parsing completed with errors. Check console.`);
          return; // Stop processing if parsing failed
        }
         
        console.log('Parsed rows:', results.data);
        setParsedRowCount(results.data.length);
        toast.info(`Successfully parsed ${results.data.length} rows. Processing...`);

        try {
          // Pass parsed data to the selected adapter
          // Need to cast results.data as it might have nulls from dynamicTyping
          const processedData: ProcessedImport[] = adapter(results.data as any[]); // Use 'as any[]' for now, refine type later
          console.log("Processed Transactions:", processedData);
          
          const successfulImports = processedData.filter(p => p.data && !p.error && !p.skipped && !p.needsReview);
          const skippedCount = processedData.filter(p => p.skipped).length;
          const errorCount = processedData.filter(p => p.error).length;
          const reviewCount = processedData.filter(p => p.needsReview).length;
          
          setProcessedRowCount(successfulImports.length);
          setImportResults({ success: successfulImports.length, skipped: skippedCount, errors: errorCount, review: reviewCount });

          if (successfulImports.length === 0) {
              toast.info("No valid transactions found to import after processing.");
              setIsLoading(false);
              return;
          }

          // --- Encrypt and Prepare Payload for API ---
          toast.info(`Encrypting ${successfulImports.length} transactions...`);
          const payloadForApi: BulkApiPayloadItem[] = [];
          for (const item of successfulImports) {
              if (!item.data) continue; // Should not happen due to filter, but safety check
              
              const sensitivePayload = {
                  type: item.data.type,
                  amount: item.data.amount,
                  price: item.data.price,
                  fee: item.data.fee,
                  wallet: item.data.wallet,
                  notes: item.data.notes,
                  counterparty: item.data.counterparty,
                  // Add any other fields that should be encrypted
              };
              
              const encryptedData = await encryptString(JSON.stringify(sensitivePayload), encryptionKey);
              
              payloadForApi.push({
                  timestamp: item.data.timestamp instanceof Date ? item.data.timestamp.toISOString() : new Date().toISOString(), // Ensure ISO string
                  tags: item.data.tags ?? [], // Ensure tags is an array
                  asset: item.data.asset ?? 'BTC', // Default asset
                  priceAsset: item.data.priceAsset ?? 'USD', // Default price asset
                  feeAsset: item.data.feeAsset, // Can be null/undefined
                  exchangeTxId: item.data.exchangeTxId,
                  encryptedData: encryptedData,
              });
          }
          // -------------------------------------------

          console.log("Payload ready for API:", payloadForApi);

          // --- Send payloadForApi to POST /api/transactions/bulk --- 
          try {
            toast.info(`Sending ${payloadForApi.length} transactions to server...`);
            const response = await fetch('/api/transactions/bulk', { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payloadForApi)
            });

            if (!response.ok) {
              let errorMsg = "Bulk import API failed";
              try {
                  const errorData = await response.json();
                  if (errorData && errorData.error) {
                    errorMsg = errorData.error;
                  }
              } catch { /* Ignore JSON parse error */ }
              throw new Error(`${errorMsg} (Status: ${response.status})`);
            }

            const result = await response.json();
            toast.success(`Successfully imported ${result.count} transactions.`);
            // Optionally revalidate the main transactions list after successful import
            // mutateSWR(); // If useSWR is available here or passed via props
            
          } catch (apiError) {
             console.error("Bulk API Error:", apiError);
             toast.error(`Failed to save imported transactions: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
          } finally {
             setIsLoading(false); // Ensure loading stops even if API fails
          }
          // ---------------------------------------------------------

        } catch (adapterOrEncryptError) {
            setIsLoading(false);
            console.error('Adapter processing or encryption error:', adapterOrEncryptError);
            toast.error(`Error processing file data: ${adapterOrEncryptError instanceof Error ? adapterOrEncryptError.message : 'Unknown error'}`);
        }
      },
      error: (err: Error) => {
        setIsLoading(false);
        console.error('PapaParse critical error:', err);
        toast.error(`Failed to parse file: ${err.message}`);
      }
    });
  };

  return (
    <div className="p-6 border rounded-lg max-w-lg mx-auto space-y-4"> {/* Increased max-width */}
      <h2 className="text-xl font-semibold">Import Transactions</h2>
      
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="csv-file">Upload CSV File</Label>
        <Input 
          id="csv-file"
          type="file" 
          accept=".csv" 
          onChange={handleFileChange} 
          disabled={isLoading}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
      </div>

      {selectedFile && (
        <p className="text-sm text-muted-foreground">
          Selected: {selectedFile.name}
        </p>
      )}

      <Button 
        onClick={handleImport} 
        disabled={!selectedFile || isLoading || !isKeySet} // Also disable if key not set
        className="w-full"
      >
        {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
        {isLoading ? 'Processing...' : (isKeySet ? 'Import File' : 'Set Passphrase First')}
      </Button>

      {/* Display Processing Results */}
      {importResults && (
        <div className="text-sm space-y-1 pt-2 text-muted-foreground">
            <p>Parsed: {importResults.skipped + importResults.errors + importResults.review + importResults.success} rows</p>
            <p className="text-green-600">Ready to Import: {importResults.success}</p>
            {importResults.skipped > 0 && <p>Skipped: {importResults.skipped}</p>}
            {importResults.errors > 0 && <p className="text-red-600">Errors: {importResults.errors}</p>}
            {importResults.review > 0 && <p className="text-orange-500">Needs Review: {importResults.review}</p>}
        </div>
      )}
    </div>
  );
} 
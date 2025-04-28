"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from '@/components/Spinner';
import { toast } from 'sonner';
import { useEncryption } from "@/context/EncryptionContext";
import { processStrikeCsv } from '@/lib/importAdapters/strike';
import { processRiverCsv } from '@/lib/importAdapters/river';
import { encryptString } from "@/lib/encryption";
import type { Transaction } from "@/lib/types";

interface TransactionImporterProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ProcessedImport {
  data?: Partial<Transaction>; 
  error?: string;
  skipped?: boolean;
  reason?: string; 
  needsReview?: boolean;
  needsPrice?: boolean; 
  sourceRow: Record<string, any>;
}

interface BulkApiPayloadItem {
    timestamp: string;
    tags?: string[];
    asset: string;
    priceAsset?: string;
    feeAsset?: string;
    exchangeTxId?: string | null;
    encryptedData: string;
}

type SourceType = "strike" | "river" | "unknown";

function detectSourceFromHeaders(headers: string[]): SourceType {
    const lowerHeaders = headers.map(h => h?.toLowerCase() ?? '');
    if (lowerHeaders.includes('transaction id') && lowerHeaders.includes('currency 1')) return "strike";
    if (lowerHeaders.includes('sent amount') && lowerHeaders.includes('received amount') && lowerHeaders.includes('tag')) return "river";
    return "unknown";
}

export function TransactionImporter({ onSuccess, onCancel }: TransactionImporterProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<SourceType | "auto">("auto");
  
  const { encryptionKey, isKeySet } = useEncryption();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileName(file?.name || '');
    setParsedCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    setSelectedSource("auto");
    event.target.value = '';

    if (file) {
      Papa.parse(file, {
        preview: 1, header: true, skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            const detected = detectSourceFromHeaders(results.meta.fields);
            if (detected !== "unknown") {
              setSelectedSource(detected); 
              toast.info(`Detected ${detected.charAt(0).toUpperCase() + detected.slice(1)} format.`);
            } else {
              toast.info("Could not auto-detect source. Please select manually.");
            }
          } else { toast.warning("Could not read headers from CSV."); }
        },
        error: (err) => { toast.error(`Error reading file headers: ${err.message}`); }
      });
    }
  };

  const handleImport = () => {
    if (!selectedFile || !isKeySet || !encryptionKey) {
      toast.error("Please select a file and set your passphrase.");
      return;
    }

    setIsLoading(true);
    setParsedCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    console.log(`Starting parse for file: ${selectedFile.name}`);

    let adapter: (rows: Record<string, any>[]) => ProcessedImport[];
    if (selectedFile.name.toLowerCase().includes('river')) {
      adapter = processRiverCsv as any;
      toast.info("Detected River CSV format.");
    } else {
      adapter = processStrikeCsv;
      toast.info("Detected Strike CSV format (default).");
    }

    Papa.parse<Record<string, any>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        setParsedCount(results.data.length);
        
        if (results.errors.length > 0) {
          setIsLoading(false);
          console.error('Parsing errors:', results.errors);
          toast.error(`Parsing completed with errors. Check console.`);
          return;
        }

        console.log('Parsed rows:', results.data);
        toast.info(`Successfully parsed ${results.data.length} rows. Processing...`);

        try {
          const processedData: ProcessedImport[] = adapter(results.data as any[]); 
          console.log("Processed Transactions:", processedData);

          const successfulImports = processedData.filter(p => p.data && !p.error && !p.skipped && !p.needsReview);
          const skippedImports = processedData.filter(p => p.skipped || p.error || p.needsReview);
          
          setImportedCount(successfulImports.length);
          setSkippedCount(skippedImports.length);

          if (successfulImports.length === 0) {
              toast.info("No valid transactions found to import after processing.");
              setIsLoading(false);
              return;
          }

          toast.info(`Encrypting ${successfulImports.length} transactions...`);
          const payloadForApi: BulkApiPayloadItem[] = [];
          for (const item of successfulImports) {
              if (!item.data) continue;
              
              const sensitivePayload = {
                  type: item.data.type,
                  amount: item.data.amount,
                  price: item.data.price,
                  fee: item.data.fee,
                  wallet: item.data.wallet,
                  notes: item.data.notes,
                  counterparty: item.data.counterparty,
              };
              
              const encryptedData = await encryptString(JSON.stringify(sensitivePayload), encryptionKey);
              
              payloadForApi.push({
                  timestamp: item.data.timestamp instanceof Date ? item.data.timestamp.toISOString() : new Date().toISOString(),
                  tags: item.data.tags ?? [],
                  asset: item.data.asset ?? 'BTC',
                  priceAsset: item.data.priceAsset ?? 'USD',
                  feeAsset: item.data.feeAsset,
                  exchangeTxId: item.data.exchangeTxId,
                  encryptedData: encryptedData,
              });
          }
          
          console.log("Payload ready for API:", payloadForApi);

          try {
            toast.info(`Sending ${payloadForApi.length} transactions to server...`);
            const response = await fetch('/api/transactions/bulk', { 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payloadForApi)
            });

            if (!response.ok) {
              let errorMsg = "Bulk import API failed";
              try {
                  const errorData = await response.json();
                  if (errorData && errorData.error) errorMsg = errorData.error;
              } catch { /* Ignore */ }
              throw new Error(`${errorMsg} (Status: ${response.status})`);
            }

            const result = await response.json();
            toast.success(`Successfully imported ${result.count} transactions.`);
            setImportedCount(result.count);
            onSuccess?.();
            
          } catch (apiError) {
             console.error("Bulk API Error:", apiError);
             toast.error(`Failed to save imported transactions: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`);
          } finally {
             setIsLoading(false); 
          }

        } catch (adapterOrEncryptError) {
            setIsLoading(false);
            console.error('Adapter/Encryption error:', adapterOrEncryptError);
            toast.error(`Error processing file: ${adapterOrEncryptError instanceof Error ? adapterOrEncryptError.message : 'Unknown error'}`);
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
    <div className="space-y-4 p-6">
      <div className="flex items-center space-x-2">
        <label className="flex-shrink-0">
          <span className="sr-only">Choose file</span>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isLoading}
            className="hidden"
          />
          <Button asChild variant="outline" size="sm" disabled={isLoading}>
            <span>Choose File</span>
          </Button>
        </label>
        <p className="flex-1 min-w-0 text-sm text-muted-foreground">
          {fileName || 'No file selected'}
        </p>
      </div>

      {(parsedCount > 0) && (
        <div className="mt-4 grid grid-cols-3 gap-4 w-full border-t pt-4">
          <div className="flex flex-col items-center space-y-1 text-center min-w-0">
            <span className="text-xs text-muted-foreground">Parsed</span>
            <span className="text-lg font-medium truncate">{parsedCount}</span>
          </div>
          <div className="flex flex-col items-center space-y-1 text-center min-w-0">
            <span className="text-xs text-green-600">Imported</span>
            <span className="text-lg font-medium text-green-600 truncate">{importedCount}</span>
          </div>
          <div className="flex flex-col items-center space-y-1 text-center min-w-0">
            <span className="text-xs text-red-500">Skipped/Errors</span>
            <span className="text-lg font-medium text-red-500 truncate">{skippedCount}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          disabled={!selectedFile || isLoading || !isKeySet}
        >
          {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
          {isLoading ? 'Importing...' : (isKeySet ? 'Import File' : 'Set Passphrase First')}
        </Button>
      </div>
    </div>
  );
} 
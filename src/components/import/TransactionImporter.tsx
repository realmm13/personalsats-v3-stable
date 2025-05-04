"use client";

import React, { useState, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from '@/components/Spinner';
import { toast } from 'sonner';
import { processStrikeCsv } from '@/lib/importAdapters/strike';
import { processRiverCsv } from '@/lib/importAdapters/river';
import { encryptString } from "@/lib/encryption";
import type { Transaction } from "@/lib/types";
import { useEncryption } from '@/context/EncryptionContext';

interface TransactionImporterProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isKeySet: boolean;
  encryptionKey: CryptoKey | null;
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

export function TransactionImporter({
  onSuccess,
  onCancel,
  isKeySet,
  encryptionKey
}: TransactionImporterProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [selectedSource, setSelectedSource] = useState<SourceType | "auto">("auto");
  const [autoDetectedSource, setAutoDetectedSource] = useState<SourceType>("unknown");
  const { encryptionPhrase } = useEncryption();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileName(file?.name || '');
    setParsedCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    setSelectedSource("auto");
    setAutoDetectedSource("unknown");
    event.target.value = '';

    if (file) {
      Papa.parse(file, {
        preview: 1, header: true, skipEmptyLines: true,
        complete: (results) => {
          if (results.meta.fields) {
            const detected = detectSourceFromHeaders(results.meta.fields);
            setAutoDetectedSource(detected);
            if (detected !== "unknown") {
              setSelectedSource(detected);
            } else {
              setSelectedSource("auto");
              toast.info("Could not auto-detect source. Please select manually.");
            }
          } else { toast.warning("Could not read headers from CSV."); }
        },
        error: (err) => { toast.error(`Error reading file headers: ${err.message}`); }
      });
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !isKeySet || !encryptionKey) {
      toast.error("Please select a file and ensure your passphrase is set.");
      return;
    }
    if (!encryptionPhrase) {
      toast.error("Please enter your encryption passphrase first.");
      return;
    }

    // Determine the final adapter type (must be 'strike' or 'river')
    let finalAdapterType: "strike" | "river";

    if (selectedSource === "strike" || selectedSource === "river") {
      // User explicitly selected a valid type
      finalAdapterType = selectedSource;
    } else if (autoDetectedSource === "strike" || autoDetectedSource === "river") {
      // Auto-detection found a valid type, and user didn't override with a different valid type
      finalAdapterType = autoDetectedSource;
    } else {
      // Fallback if detection failed or user selected 'auto'
      finalAdapterType = selectedFile.name.toLowerCase().includes('river') ? 'river' : 'strike';
      toast.info(`CSV source wasn't explicitly selected or detected, defaulting to: ${finalAdapterType}`);
    }
    
    // Now finalAdapterType is guaranteed to be 'strike' or 'river'

    setIsLoading(true);
    setParsedCount(0);
    setImportedCount(0);
    setSkippedCount(0);
    console.log(`Starting parse for file: ${selectedFile.name}, using source: ${finalAdapterType}`);

    let adapter: (rows: Record<string, any>[]) => ProcessedImport[];
    if (finalAdapterType === 'river') {
      adapter = processRiverCsv as any;
    } else { // It must be 'strike'
      adapter = processStrikeCsv;
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
              if (!item.data || !encryptionKey) continue;
              
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
                body: JSON.stringify({ rows: payloadForApi, encryptionPhrase })
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
            toast.success(`Successfully imported ${result.imported || result.count} transactions.`);
            setImportedCount(result.imported || result.count);
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

  const sourceOverridden = 
    selectedFile && 
    autoDetectedSource !== 'unknown' && 
    selectedSource !== 'auto' && 
    selectedSource !== autoDetectedSource;

  const sourceLabel = selectedFile 
    ? `CSV Source (auto-detected: ${autoDetectedSource === 'unknown' ? 'none' : autoDetectedSource})`
    : 'CSV Source';

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

      {selectedFile && (
        <div>
          <Label htmlFor="source-select">{sourceLabel}</Label>
          <Select
            value={selectedSource}
            onValueChange={(value) => setSelectedSource(value as SourceType | "auto")}
            disabled={isLoading}
          >
            <SelectTrigger id="source-select">
              <SelectValue placeholder="Select CSV Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-Detect ({autoDetectedSource})</SelectItem>
              <SelectItem value="strike">Strike</SelectItem>
              <SelectItem value="river">River</SelectItem>
            </SelectContent>
          </Select>
          {sourceOverridden && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              You've manually selected a source. Make sure this matches your file.
            </p>
          )}
          {!sourceOverridden && (
            <p className="text-xs text-muted-foreground mt-1">
              Select the source manually if auto-detection is incorrect.
            </p>
          )}
        </div>
      )}

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
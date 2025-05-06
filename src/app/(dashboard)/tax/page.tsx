"use client";
import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { api } from "@/trpc/react";
import { CostBasisMethod } from "@/lib/cost-basis";
import { formatUSD } from "@/lib/price";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import { format } from "date-fns";
import { Settings } from 'lucide-react';
import { SettingsDialog } from "@/components/SettingsDialog";
import type { TaxReport } from "@/lib/tax/report";
import { useRouter } from 'next/navigation';
import { authClient } from "@/server/auth/client"; // Import the configured auth client

// New component to contain the main logic
function TaxPageContent() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const router = useRouter();

  // Fetch user settings (now guaranteed to run only when authenticated)
  const { data: userSettings, isLoading: isLoadingSettings, error: userSettingsError } = api.userSettings.get.useQuery(
    undefined,
    { 
      // Removed onError handler as it's not a valid option here
      // Error handling will be done using the returned 'error' object below
    }
  );
  const selectedMethod = userSettings?.accountingMethod ?? CostBasisMethod.HIFO;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: priceData, isLoading: isLoadingPrice } = api.price.getCurrent.useQuery(
    undefined,
    {
      refetchInterval: 60000,
      staleTime: 55000,
      // Still enabled based on settings loading, as it depends on settings implicitly
      // enabled: !isLoadingSettings && !!userSettings
      // Or remove enabled if price doesn't strictly depend on settings
    }
  );
  const currentBtcPrice = priceData?.price;

  const { data: report, isLoading: isLoadingReport, error, refetch } = api.tax.getReportByYear.useQuery({
    year: selectedYear,
    method: selectedMethod,
  }, {
    // Enable only when prerequisites are met (settings loaded, price available)
    enabled: !isLoadingSettings && !!userSettings && !!currentBtcPrice,
  });

  // isLoadingCombined now only needs to check query loading states
  const isLoadingCombined = isLoadingSettings || isLoadingReport || isLoadingPrice;

  useEffect(() => {
    // Add a check to ensure refetch isn't called unnecessarily before data is ready
    if (selectedMethod && currentBtcPrice && !isLoadingCombined) {
       refetch();
    }
   // Ensure refetch is stable or manage its inclusion carefully
  }, [selectedYear, selectedMethod, currentBtcPrice, isLoadingCombined, refetch]);


  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleExportCSV = () => {
    console.log("Export CSV");
  };

  const handleExportPDF = () => {
    console.log("Export PDF");
  };

   if (isLoadingCombined) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
         <Spinner size="lg" />
      </div>
    );
  }

  if (error || userSettingsError) { // Combine error checks
    const displayError = error || userSettingsError; // Prioritize report error if both exist

    // Ensure displayError is not null before accessing properties
    if (displayError) {
      // Check if the error is an UNAUTHORIZED error specifically
      if (displayError.data?.code === 'UNAUTHORIZED') {
        // Handle unauthorized specifically, maybe redirect or show a specific message
        // This case might indicate the session became invalid *after* the initial check
        // For now, just log and show generic error
        console.error("Received UNAUTHORIZED error despite initial auth check.");
      }
      return <div className="text-red-500 p-6">Error loading data: {displayError.message}</div>; // Use generic message
    } else {
        // Fallback case if somehow both errors are truthy but displayError is null (shouldn't happen)
        return <div className="text-red-500 p-6">An unexpected error occurred.</div>;
    }
  }

  // --- Rest of the JSX for TaxPageContent (starting from the return with space-y-6) ---
  return (
    <div className="space-y-6 p-6">
       <div className="flex items-center justify-between">
         <Button variant="ghost" onClick={() => router.back()} className="text-sm text-gray-600 hover:underline p-0 h-auto">
           ← Dashboard
         </Button>
         <div className="flex items-center gap-4">
           {currentBtcPrice ? (
             <span className="text-sm text-gray-700">
               BTC: {formatUSD(currentBtcPrice)}
             </span>
           ) : null}
           <Button variant="ghost" size="icon" onClick={handleSettings} aria-label="Tax Settings">
             <Settings size={20} />
           </Button>
         </div>
       </div>
       <h1 className="text-2xl font-bold">Tax Ledger</h1>

      <div className="flex items-center space-x-4">
         <Select
           value={selectedYear.toString()}
           onValueChange={(v) => setSelectedYear(Number(v))}
         >
           <SelectTrigger className="w-[120px]">
             <SelectValue placeholder="Year" />
           </SelectTrigger>
           <SelectContent>
             {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
               <SelectItem key={y} value={y.toString()}>
                 {y}
               </SelectItem>
             ))}
           </SelectContent>
         </Select>

        <Select
           value={selectedMethod}
           disabled={isLoadingSettings} // Still disable if settings are loading
         >
           <SelectTrigger className="w-[120px]">
             <SelectValue placeholder="Method" />
           </SelectTrigger>
           <SelectContent>
             {(Object.values(CostBasisMethod)).map((m) => (
               <SelectItem key={m} value={m}>
                 {m}
               </SelectItem>
             ))}
           </SelectContent>
         </Select>
       </div>

      {report && (
         <>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <Card>
               <CardHeader>
                 <CardTitle>Total Realized</CardTitle>
                 <p>{formatUSD(report.totalRealizedGain)}</p>
               </CardHeader>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle>ST Gain</CardTitle>
                 <p>{formatUSD(report.realizedGainST)}</p>
               </CardHeader>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle>LT Gain</CardTitle>
                 <p>{formatUSD(report.realizedGainLT)}</p>
               </CardHeader>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle>Unrealized</CardTitle>
                 <p>{formatUSD(report.totalUnrealizedGain)}</p>
               </CardHeader>
             </Card>
           </div>

          <div className="flex space-x-2 mt-4"> {/* Added margin top */}
             <Button disabled onClick={handleExportCSV}>Export CSV</Button>
             <Button disabled onClick={handleExportPDF}>Export 8949 PDF</Button>
           </div>

          <Table className="mt-4"> {/* Added margin top */}
            <>
              <TableHeader>
                <TableRow>
                  {["Date", "Amount", "Proceeds", "Cost Basis", "Gain", "Term"].map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            </>
            <>
              <TableBody>
                {/* Conditionally render placeholder row or data rows */}
                {!report?.details || report.details.length === 0 ? (
                  <TableRow> {/* Wrap message in TableRow */}
                    <TableCell
                      colSpan={6} /* Match number of columns */
                      className="text-center text-gray-500 py-4"
                    >
                    No sales transactions recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.details.map((item: TaxReport['details'][0], index: number) => (
                    <TableRow key={item.saleTxId || index}>
                      <TableCell>{format(new Date(item.saleDate), 'yyyy-MM-dd')}</TableCell>
                      <TableCell className="text-right">{item.amountSold.toFixed(8)}</TableCell> {/* Use existing fields */}
                      <TableCell className="text-right">{formatUSD(item.proceeds)}</TableCell>
                      <TableCell className="text-right">{formatUSD(item.costBasis)}</TableCell>
                      <TableCell className={`text-right ${item.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatUSD(item.gain)}
                      </TableCell>
                      <TableCell>{item.term}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </>
          </Table>
         </>
       )}
       {/* Render placeholder if report is null/undefined after loading */}
        {!report && !isLoadingCombined && !error && (
          <div className="text-center text-gray-500 py-4">No report data available.</div>
        )}


      {/* Settings Dialog */}
      {isSettingsOpen && (
        <SettingsDialog
          open={isSettingsOpen} // Use 'open' prop
          onOpenChange={setIsSettingsOpen} // Use 'onOpenChange' prop
          // currentSettings prop removed as it's not accepted
          // The dialog likely fetches its own data or infers it
        />
      )}
    </div>
  );
}


export default function TaxPage() {
  // Use session hook from the configured client
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const isAuthenticated = !!session?.user; // Check if user exists in session data
  const router = useRouter(); // Get router instance

  // Show loading spinner while session is being checked
  if (isSessionLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
         <Spinner size="lg" />
      </div>
    );
  }

  // If session has loaded and user is not authenticated, handle redirect
  if (!isAuthenticated) {
    // Use useEffect for client-side redirect
    useEffect(() => {
      // Redirect to signin, including the current path as callbackUrl
      const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/signin?callbackUrl=${callbackUrl}`);
    }, [router]);

     // Render loading spinner while redirecting
     return (
       <div className="flex justify-center items-center h-screen">
         <Spinner size="lg" />
       </div>
     );
   }

  // If authenticated, render the main content component
  return <TaxPageContent />;
}

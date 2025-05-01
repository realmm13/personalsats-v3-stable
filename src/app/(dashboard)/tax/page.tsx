"use client";
import React, { useState, useEffect } from 'react';
import Link from "next/link";
import { trpc } from "@/trpc/react";
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

export default function TaxPage() {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const { data: userSettings, isLoading: isLoadingSettings } = trpc.userSettings.get.useQuery();
  const selectedMethod = userSettings?.accountingMethod ?? CostBasisMethod.HIFO;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { data: priceData, isLoading: isLoadingPrice } = trpc.price.getCurrent.useQuery(
    undefined, 
    {
      refetchInterval: 60000, 
      staleTime: 55000, 
    }
  );
  const currentBtcPrice = priceData?.price;

  const { data: report, isLoading: isLoadingReport, error, refetch } = trpc.tax.byYear.useQuery({
    year: selectedYear,
    method: selectedMethod as CostBasisMethod,
  }, {
    enabled: !isLoadingSettings && !!currentBtcPrice,
  });

  const isLoadingCombined = isLoadingSettings || isLoadingReport || isLoadingPrice;

  useEffect(() => {
    if (selectedMethod && currentBtcPrice) {
      refetch();
    }
  }, [selectedYear, selectedMethod, currentBtcPrice, refetch]);

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
      <div className="flex justify-center items-center h-screen">
         <Spinner size="lg" />
      </div>
    );
  }
  if (error) {
    return <div className="text-red-500 p-6">Error loading report: {error.message}</div>;
  }

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
          disabled={isLoadingSettings}
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

          <div className="flex space-x-2">
            <Button disabled onClick={handleExportCSV}>Export CSV</Button>
            <Button disabled onClick={handleExportPDF}>Export 8949 PDF</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                {["Date", "Amount", "Proceeds", "Cost Basis", "Gain", "Term"].map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.details.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                      No sales transactions found for this year.
                    </TableCell>
                  </TableRow>
              ) : (
                 report.details.map((item: TaxReport['details'][0]) => (
                  <TableRow key={item.saleTxId}>
                    <TableCell>{format(item.saleDate, "yyyy-MM-dd")}</TableCell>
                    <TableCell className="text-right">{item.amountSold.toFixed(8)}</TableCell>
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
          </Table>
        </>
      )}

      <SettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />
    </div>
  );
}

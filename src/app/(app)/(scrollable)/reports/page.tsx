import React from 'react'
import { PortfolioChart } from '@/components/PortfolioChart'
import type { PortfolioSnapshot } from '@/lib/types' // Keep type for chart
import { PrismaClient } from '@prisma/client' // Import Prisma Client

// Instantiate Prisma Client outside the component
const prisma = new PrismaClient()

// Define the expected shape from Prisma query for type safety
interface SnapshotQueryResult {
  date: Date;
  totalValue: number;
  totalCost: number;
}

// Remove the getPortfolioData function
// async function getPortfolioData(): Promise<PortfolioSnapshot[]> { ... }

export default async function ReportsPage() {
  let data: PortfolioSnapshot[] = []; // Default to empty array

  try {
    // Add console logs for debugging
    console.log('ReportsPage: Prisma client is', typeof prisma, prisma ? Object.keys(prisma) : 'undefined');
    console.log('ReportsPage: Has dailySnapshot property?', prisma?.dailySnapshot ? 'Yes' : 'No');

    // Explicitly type the result of findMany
    const snaps: SnapshotQueryResult[] = await prisma.dailySnapshot.findMany({
      orderBy: { date: 'asc' },
      select: { // Select only necessary fields
        date: true,
        totalValue: true,
        totalCost: true,
      },
    })

    // Add explicit type to 's' parameter in map
    data = snaps.map((s: SnapshotQueryResult) => ({
      date: s.date.toISOString().slice(0, 10), // Format date as 'YYYY-MM-DD'
      portfolioValue: s.totalValue,
      costBasis: s.totalCost,
    }))

  } catch (error) {
    console.error("ReportsPage: Error fetching portfolio snapshots directly:", error);
    // Data remains an empty array, the component will show the "No data" message
  }

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-bold">Performance Reports</h1>
      {/* Conditional rendering logic remains the same */}
      {data.length > 1 ? (
        <PortfolioChart data={data} />
      ) : (
        <div className="bg-card p-4 rounded-lg border flex items-center justify-center h-[348px]">
           <p className="text-muted-foreground">
             {data.length === 0 ? "No snapshot data available." : "Not enough data to display chart."}
           </p>
         </div>
      )}
      {/* you can add more charts below (e.g. monthly returns, drawdowns, etc.) */}
    </div>
  )
} 
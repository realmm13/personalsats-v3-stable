"use client";

import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts' // Make sure recharts is installed
import type { PortfolioSnapshot } from '@/lib/types' // Ensure this type exists and matches

interface PortfolioChartProps {
  data: PortfolioSnapshot[]
}

// Example of PortfolioSnapshot (ensure your type matches):
// { date: string | Date; portfolioValue: number; costBasis: number; }

export function PortfolioChart({ data }: PortfolioChartProps) {
  // Handle empty or insufficient data
  if (!data || data.length < 2) {
    return (
      <div className="bg-card p-4 rounded-lg border flex items-center justify-center h-[348px]"> {/* Match height */} 
        <p className="text-muted-foreground">Not enough data to display chart.</p>
      </div>
    );
  }
  
  // Add console log here to inspect data
  console.log("PortfolioChart received data:", data);

  return (
    // Use theme variables for background, border, padding
    <div className="bg-card p-4 rounded-lg border">
      <h2 className="text-lg font-semibold text-foreground mb-2">Portfolio vs Cost Basis</h2>
      <ResponsiveContainer width="100%" height={300}> 
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {/* Use theme border color for grid */}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /> 
          {/* Use theme text color for axes */}
          <XAxis 
             dataKey="date" 
             tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
             tickFormatter={(value) => {
                 if (value instanceof Date) return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                 if (typeof value === 'string') {
                     try { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return value; }
                 }
                 return String(value);
             }}
             // Consider adding interval='preserveStartEnd' or interval={...} if axis gets crowded
           />
          <YAxis 
             tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
             tickFormatter={(value: number | string) => {
               if (typeof value === 'number') return `$${value.toLocaleString()}`;
               if (typeof value === 'string') {
                 const num = Number(value);
                 return isNaN(num) ? value : `$${num.toLocaleString()}`;
               }
               return String(value);
             }}
           />
           {/* Use theme colors for Tooltip */}
           <Tooltip
             contentStyle={{ 
                 backgroundColor: "hsl(var(--background))", 
                 borderColor: "hsl(var(--border))",
                 color: "hsl(var(--foreground))",
                 borderRadius: "var(--radius)",
              }}
             itemStyle={{ color: "hsl(var(--foreground))" }}
             formatter={(value: number | string) => {
               if (typeof value === 'number') return `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
               if (typeof value === 'string') {
                 const num = Number(value);
                 return isNaN(num) ? value : `$${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
               }
               return String(value);
             }}
           />
           {/* Use theme text color for Legend */}
           <Legend 
              verticalAlign="top" 
              align="right" 
              wrapperStyle={{ color: "hsl(var(--foreground))", fontSize: 12, paddingBottom: '10px' }} // Using foreground for legend text too
            />
           {/* Lines with correct colors */}
           <Line
             type="monotone"
             dataKey="portfolioValue"
             name="Portfolio Value"
             stroke="#F97316" // Orange
             dot={false}
             strokeWidth={2}
           />
           <Line
             type="monotone"
             dataKey="costBasis"
             name="Cost Basis"
             stroke="#F6E05E" // Yellow
             dot={false}
             strokeWidth={2}
           />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
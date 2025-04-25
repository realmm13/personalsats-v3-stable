import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Replace with real data from your database
  return NextResponse.json({
    totalValue: 45231.89,
    change24h: 20.1,
    costBasis: 38000.00
  });
} 
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET() {
  // TODO: Replace with real data from your database
  const trades = [
    {
      id: randomUUID(),
      type: 'buy',
      amount: 0.5,
      date: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
    },
    {
      id: randomUUID(),
      type: 'sell',
      amount: 0.2,
      date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
    },
    {
      id: randomUUID(),
      type: 'buy',
      amount: 0.3,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    }
  ];

  return NextResponse.json(trades);
} 
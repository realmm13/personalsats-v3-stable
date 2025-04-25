import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Replace with real data from your database
  const history = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    
    return {
      date: date.toISOString().split('T')[0],
      value: 40000 + Math.random() * 10000
    };
  });

  return NextResponse.json(history);
} 
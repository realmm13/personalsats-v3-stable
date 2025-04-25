import { NextResponse } from "next/server";
import { getBitcoinPrice } from "@/lib/price";

export async function GET() {
  try {
    // Get the raw number price
    const priceNumber = await getBitcoinPrice(false) as number; 
    // Return the structure the form expects
    return NextResponse.json({ price: { usd: priceNumber } }); 
  } catch (error) {
    console.error("Error fetching current Bitcoin price:", error);
    return NextResponse.json(
      { error: "Failed to fetch current Bitcoin price" },
      { status: 500 }
    );
  }
} 
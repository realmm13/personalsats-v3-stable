export async function fetchBtcUsdCsv(): Promise<string> {
  const url = process.env.BTC_USD_CSV_URL;
  if (!url) throw new Error("BTC_USD_CSV_URL is not set");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch CSV: ${resp.statusText}`);
  return await resp.text();
} 
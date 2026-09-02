import { createServerFn } from "@tanstack/react-start";

export type PriceSource = "Coinbase" | "CoinGecko";

export type BtcPrice = {
  usd: number;
  source: PriceSource;
  sourceUrl: string;
  fetchedAt: number;
};

const CACHE_MS = 30_000;
let cache: { value: BtcPrice; expires: number } | null = null;

const SOURCE_URL: Record<PriceSource, string> = {
  Coinbase: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
  CoinGecko:
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
};

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "bitsconverter.com/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function readAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid price");
  return n;
}

async function fromCoinbase(): Promise<BtcPrice> {
  const json = (await fetchJson(SOURCE_URL.Coinbase, 2500)) as {
    data?: { amount?: string };
  };
  return {
    usd: readAmount(json?.data?.amount),
    source: "Coinbase",
    sourceUrl: SOURCE_URL.Coinbase,
    fetchedAt: Date.now(),
  };
}

async function fromCoinGecko(): Promise<BtcPrice> {
  const json = (await fetchJson(SOURCE_URL.CoinGecko, 2500)) as {
    bitcoin?: { usd?: number };
  };
  return {
    usd: readAmount(json?.bitcoin?.usd),
    source: "CoinGecko",
    sourceUrl: SOURCE_URL.CoinGecko,
    fetchedAt: Date.now(),
  };
}

export const fetchBtcPrice = createServerFn({ method: "GET" }).handler(
  async (): Promise<BtcPrice> => {
    const now = Date.now();
    if (cache && cache.expires > now) return cache.value;
    const stale = cache?.value ?? null;

    try {
      const value = await fromCoinbase();
      cache = { value, expires: now + CACHE_MS };
      return value;
    } catch {
      try {
        const value = await fromCoinGecko();
        cache = { value, expires: now + CACHE_MS };
        return value;
      } catch (error) {
        if (stale) return stale;
        throw error;
      }
    }
  },
);

export const PRICE_CACHE_KEY = "bitsconverter:price";

export function writeStoredPrice(price: BtcPrice) {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(price));
  } catch {
    // ignore quota
  }
}


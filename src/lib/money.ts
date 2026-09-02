export const SATS_PER_BIT = 100;
export const BITS_PER_BTC = 1_000_000;
export const SATS_PER_BTC = 100_000_000;
export const BTC_USD_PARITY = 1_000_000;

export const UNITS = ["bits", "sats", "btc", "usd"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_LABEL: Record<Unit, string> = {
  bits: "bits",
  sats: "sats",
  btc: "BTC",
  usd: "USD",
};

const MAX_BTC = 21_000_000;

export function bitsPerDollar(btcUsd: number): number {
  return BITS_PER_BTC / btcUsd;
}

export function usdPerBit(btcUsd: number): number {
  return btcUsd / BITS_PER_BTC;
}

export function toSats(amount: number, unit: Unit, btcUsd: number | null): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  switch (unit) {
    case "sats":
      return amount;
    case "bits":
      return amount * SATS_PER_BIT;
    case "btc":
      return amount * SATS_PER_BTC;
    case "usd": {
      if (btcUsd === null || btcUsd <= 0) return null;
      return (amount / btcUsd) * SATS_PER_BTC;
    }
  }
}

export function fromSats(sats: number, unit: Unit, btcUsd: number | null): number | null {
  if (!Number.isFinite(sats)) return null;
  switch (unit) {
    case "sats":
      return sats;
    case "bits":
      return sats / SATS_PER_BIT;
    case "btc":
      return sats / SATS_PER_BTC;
    case "usd": {
      if (btcUsd === null || btcUsd <= 0) return null;
      return (sats / SATS_PER_BTC) * btcUsd;
    }
  }
}

export function clampSats(sats: number): number {
  const max = MAX_BTC * SATS_PER_BTC;
  if (sats < 0) return 0;
  if (sats > max) return max;
  return sats;
}

/** Round half up (0.5 → away from zero for positives). */
export function roundHalfUp(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return n;
  const factor = 10 ** decimals;
  const bias = n >= 0 ? 1e-8 : -1e-8;
  return Math.round(n * factor + bias) / factor;
}

export function sanitizeDraft(raw: string, unit: Unit): string {
  let s = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (unit === "sats") {
    s = s.replace(/\./g, "");
    if (s.startsWith("00")) s = s.replace(/^0+/, "0");
    else if (s.length > 1 && s.startsWith("0")) s = s.replace(/^0+/, "") || "0";
    return s.slice(0, 16);
  }
  const dot = s.indexOf(".");
  if (dot !== -1) {
    const maxFrac = unit === "btc" ? 8 : 2;
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, maxFrac);
  }
  if (s.startsWith("00") && !s.startsWith("00.")) {
    s = s.replace(/^0+/, "0");
  } else if (s.length > 1 && s.startsWith("0") && s[1] !== ".") {
    s = s.replace(/^0+/, "") || "0";
  }
  return s.slice(0, 18);
}

export function parseDraft(draft: string): number | null {
  if (draft === "" || draft === ".") return null;
  const n = Number(draft);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function trimZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

function groupInt(intPart: string): string {
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatFixed(n: number, maxFrac: number): string {
  if (!Number.isFinite(n)) return "—";
  const neg = n < 0;
  const abs = Math.abs(n);
  const str = abs.toFixed(maxFrac);
  const trimmed = trimZeros(str);
  const [intPart, frac] = trimmed.split(".");
  const grouped = groupInt(intPart ?? "0");
  const body = frac ? `${grouped}.${frac}` : grouped;
  return neg ? `−${body}` : body;
}

export function formatUnit(n: number, unit: Unit): string {
  if (!Number.isFinite(n)) return "—";
  switch (unit) {
    case "sats":
      return formatFixed(Math.round(n), 0);
    case "bits":
      return formatBitsMoney(n);
    case "btc":
      return formatFixed(n, 8);
    case "usd":
      return formatUsd(n);
  }
}

export const BIT_SIGN = "₿";

/** Always two decimal places, grouped — same grammar as $12.91. */
export function formatFiatAmount(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = roundHalfUp(n, decimals);
  const neg = rounded < 0;
  const abs = Math.abs(rounded);
  const [intPart, frac = ""] = abs.toFixed(decimals).split(".");
  const grouped = groupInt(intPart ?? "0");
  const body = decimals > 0 ? `${grouped}.${frac}` : grouped;
  return `${neg ? "−" : ""}${body}`;
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${formatFiatAmount(n, 2)}`;
}

export function formatBitUsd(n: number): string {
  return formatUsd(n);
}

export function formatBitsMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${BIT_SIGN}${formatFiatAmount(n, 2)}`;
}

export function roundedBits(n: number): number {
  return roundHalfUp(n, 2);
}

export function satsFromDisplayedBits(n: number): number {
  return Math.round(roundedBits(n) * SATS_PER_BIT);
}

export function formatBitsQuote(n: number): string {
  return formatBitsMoney(n);
}

export function formatBtcSpot(n: number): string {
  return formatUsd(n);
}

export function toDraft(n: number, unit: Unit): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (unit === "usd" || unit === "bits") return roundHalfUp(n, 2).toFixed(2);
  if (unit === "sats") return String(Math.round(n));
  return trimZeros(n.toFixed(8));
}

export function otherUnits(unit: Unit): Unit[] {
  return UNITS.filter((item) => item !== unit);
}


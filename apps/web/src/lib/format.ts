/** Formatting and parsing helpers. Pure functions, covered by format.test.ts. */

export function truncateAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Formats a token amount held in its smallest unit. Trailing zeros are dropped
 * but at least `minFraction` decimals are kept: 12500000n with 7 decimals and
 * minFraction 2 reads "1.25".
 */
export function formatAmount(
  value: bigint,
  decimals: number,
  { minFraction = 2, maxFraction = decimals }: { minFraction?: number; maxFraction?: number } = {},
): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  let fraction = decimals > 0 ? (absolute % base).toString().padStart(decimals, "0") : "";
  fraction = fraction.slice(0, maxFraction).replace(/0+$/, "");
  if (fraction.length < minFraction) fraction = fraction.padEnd(Math.min(minFraction, decimals), "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Parses what a person typed ("1,250.5") into the token's smallest unit.
 * Returns null when the text is not a number or has too many decimals.
 */
export function parseAmount(input: string, decimals: number): bigint | null {
  const text = input.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") return null;
  const [whole = "", fraction = ""] = text.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

const UNITS: [label: string, seconds: number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/** 90061 → "1 day 1 hour"; shows the two largest non-zero units. */
export function formatDuration(totalSeconds: number | bigint): string {
  let remaining = Number(totalSeconds);
  if (remaining <= 0) return "none";
  const parts: string[] = [];
  for (const [label, size] of UNITS) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count} ${label}${count === 1 ? "" : "s"}`);
      remaining -= count * size;
    }
    if (parts.length === 2) break;
  }
  return parts.join(" ");
}

/** Compact countdown: "2d 04h", "04:59", "0:07". */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m`;
  return `${minutes}:${pad(rest)}`;
}

export function formatTimestamp(seconds: number | bigint): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(Number(seconds) * 1000),
  );
}

export function formatRelative(seconds: number | bigint, now = Date.now()): string {
  const delta = Math.round((Number(seconds) * 1000 - now) / 1000);
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const absolute = Math.abs(delta);
  if (absolute < 60) return format.format(delta, "second");
  if (absolute < 3_600) return format.format(Math.round(delta / 60), "minute");
  if (absolute < 86_400) return format.format(Math.round(delta / 3_600), "hour");
  return format.format(Math.round(delta / 86_400), "day");
}

/** Fees are quoted in stroops; 1 XLM = 10,000,000 stroops. */
export function formatFee(stroops: bigint | number | string): string {
  return `${formatAmount(BigInt(stroops), 7, { minFraction: 2, maxFraction: 7 })} XLM`;
}

export function stringifyWithBigInt(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Uint8Array) return Buffer.from(item).toString("hex");
      return item;
    },
    2,
  );
}

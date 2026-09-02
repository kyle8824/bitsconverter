import { useQuery } from "@tanstack/react-query";
import { Check, Copy, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { fetchBtcPrice, writeStoredPrice, type BtcPrice } from "@/lib/btc-price";
import {
  BTC_USD_PARITY,
  SATS_PER_BIT,
  UNIT_LABEL,
  UNITS,
  BIT_SIGN,
  bitsPerDollar,
  clampSats,
  formatBitUsd,
  formatBtcSpot,
  formatFiatAmount,
  formatFixed,
  formatUnit,
  fromSats,
  otherUnits,
  parseDraft,
  sanitizeDraft,
  satsFromDisplayedBits,
  toDraft,
  toSats,
  usdPerBit,
  type Unit,
} from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = {
  initialPrice: BtcPrice | null;
};

export function BitsConverter({ initialPrice }: Props) {
  const priceQuery = useQuery({
    queryKey: ["btc-usd"],
    queryFn: () => fetchBtcPrice(),
    initialData: initialPrice ?? undefined,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (priceQuery.data) writeStoredPrice(priceQuery.data);
  }, [priceQuery.data]);

  const price = priceQuery.data ?? null;
  const btcUsd = price?.usd ?? null;

  const [unit, setUnit] = useState<Unit>("bits");
  const [draft, setDraft] = useState("1.00");
  const [copied, setCopied] = useState<Unit | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);

  const parsed = parseDraft(draft);
  const sats = useMemo(() => {
    if (parsed === null) return null;
    const raw = toSats(parsed, unit, btcUsd);
    if (raw === null) return null;
    return clampSats(raw);
  }, [parsed, unit, btcUsd]);

  useFitText(inputWrapRef, `${unit}:${draft}`);

  const switchUnit = useCallback(
    (next: Unit) => {
      if (next === unit) {
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (sats === null) {
        setUnit(next);
        setDraft("");
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      const converted = fromSats(sats, next, btcUsd);
      setUnit(next);
      setDraft(converted === null ? "" : toDraft(converted, next));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    },
    [unit, sats, btcUsd],
  );

  const loadQuote = useCallback(
    (kind: "dollar" | "bit") => {
      if (btcUsd === null) return;
      if (kind === "dollar") {
        setUnit("bits");
        setDraft(toDraft(bitsPerDollar(btcUsd), "bits"));
      } else {
        setUnit("bits");
        setDraft("1.00");
      }
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    },
    [btcUsd],
  );

  async function copyRow(rowUnit: Unit, text: string) {
    try {
      await navigator.clipboard.writeText(text.replace(/,/g, ""));
      setCopied(rowUnit);
      window.setTimeout(
        () => setCopied((current) => (current === rowUnit ? null : current)),
        1400,
      );
    } catch {
      // clipboard can fail in embedded previews
    }
  }

  const rows = otherUnits(unit).map((rowUnit) => {
    const value = sats === null ? null : fromSats(sats, rowUnit, btcUsd);
    const display = value === null ? "—" : formatUnit(value, rowUnit);
    return { unit: rowUnit, display, raw: value };
  });

  const bits = btcUsd === null ? null : bitsPerDollar(btcUsd);
  const bitUsd = btcUsd === null ? null : usdPerBit(btcUsd);
  const underParity = bitUsd !== null && bitUsd < 1;
  const progress = bitUsd === null ? 0 : Math.min(1, Math.max(0, bitUsd));
  const remain = bitUsd === null ? null : Math.max(0, 1 - bitUsd);
  const pricePending = priceQuery.isLoading && !price;
  const priceFailed = priceQuery.isError && !price;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 pt-5 pb-5 md:max-w-4xl md:px-8 md:pt-8 md:pb-8">
      <header className="enter">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-meta text-muted">
            <span
              className={cn(
                "live-dot inline-block size-1.5 rounded-full",
                price ? "bg-accent" : "bg-faint",
              )}
              aria-hidden
            />
            <span className="font-medium tracking-kicker uppercase">
              {pricePending ? "Quote" : "Live"}
            </span>
          </p>
          <p className="font-mono text-meta text-muted tabular-nums">
            {btcUsd === null
              ? priceFailed
                ? "Price offline"
                : "BTC-USD —"
              : `BTC-USD ${formatBtcSpot(btcUsd)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="mt-2 text-left text-meta text-faint underline decoration-line underline-offset-4 transition-colors duration-150 ease-smooth hover:text-muted"
        >
          Bitcoin's final evolution for mass adoption.
        </button>
      </header>

      <section className="enter-delay-1 mt-8 md:mt-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
          <button
            type="button"
            onClick={() => loadQuote("dollar")}
            disabled={bits === null}
            className="block w-full text-left"
            aria-label={
              bits === null
                ? "$1 buys"
                : `$1 buys ${BIT_SIGN}${formatFiatAmount(bits, 2)}`
            }
          >
            <p className="text-kicker font-medium tracking-mark text-faint uppercase">$1 buys</p>
            <p className="mt-2 font-mono text-quote leading-none font-medium tracking-tight text-accent tabular-nums">
              {bits === null ? "—" : `${BIT_SIGN}${formatFiatAmount(bits, 2)}`}
            </p>
            <p className="mt-2 font-mono text-meta text-muted tabular-nums">
              {bits === null
                ? "\u00a0"
                : `${formatFixed(satsFromDisplayedBits(bits), 0)} sats`}
            </p>
          </button>

          <button
            type="button"
            onClick={() => loadQuote("bit")}
            disabled={bitUsd === null}
            className="block w-full text-left"
          >
            <p className="text-kicker font-medium tracking-mark text-faint uppercase">1 bit is</p>
            <p className="mt-2 flex items-baseline gap-3 font-mono text-quote leading-none font-medium tracking-tight text-foreground tabular-nums">
              <span>{bitUsd === null ? "—" : formatBitUsd(bitUsd)}</span>
              {underParity ? (
                <span className="font-sans text-row font-medium tracking-normal text-muted">
                  today
                </span>
              ) : null}
            </p>
          </button>
        </div>

        <div className="mt-6 md:mt-8">
          <div
            className="h-1 w-full overflow-hidden rounded-full bg-line"
            role="meter"
            aria-label="One bit toward one dollar"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={Number(progress.toFixed(4))}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-smooth"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-kicker text-faint tabular-nums">
            <span>$0</span>
            <span>
              {btcUsd !== null && btcUsd < BTC_USD_PARITY && remain !== null
                ? `$${formatFiatAmount(remain, 2)} to $1`
                : "$1"}
            </span>
          </div>
        </div>
      </section>

      <section className="enter-delay-2 mt-8 flex flex-1 flex-col justify-end border-t border-line pt-6 md:mt-10 md:justify-center md:pt-10">
        <div className="mx-auto w-full max-w-md">
          <label
            htmlFor="bit-amount"
            className="text-kicker font-medium tracking-kicker text-faint uppercase"
          >
            Amount
          </label>
          <div
            ref={inputWrapRef}
            className="amount-row mt-3 flex items-baseline border-b border-line pb-2"
          >
            {unit === "bits" || unit === "usd" ? (
              <span
                className="font-sans font-medium leading-none text-foreground"
                aria-hidden
              >
                {unit === "bits" ? BIT_SIGN : "$"}
              </span>
            ) : null}
            <input
              id="bit-amount"
              ref={inputRef}
              value={draft}
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              suppressHydrationWarning
              aria-label={
                unit === "bits"
                  ? "Amount in bits"
                  : unit === "usd"
                    ? "Amount in USD"
                    : `Amount in ${UNIT_LABEL[unit]}`
              }
              placeholder={unit === "bits" || unit === "usd" ? "0.00" : "0"}
              className="amount-input min-w-0 flex-1 bg-transparent leading-none font-medium tracking-tight text-foreground outline-none"
              onChange={(event) => setDraft(sanitizeDraft(event.target.value, unit))}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={() => {
                if (parsed === null || unit === "btc") return;
                setDraft(toDraft(parsed, unit));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </div>

          <UnitSwitch value={unit} onChange={switchUnit} />

          <ul className="mt-5 divide-y divide-line" aria-live="polite">
            {rows.map((row) => (
              <li key={row.unit} className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => switchUnit(row.unit)}
                  className="flex min-h-12 flex-1 items-center justify-between gap-4 py-3 text-left transition-transform duration-150 ease-smooth active:scale-96 md:min-h-14"
                >
                  <span className="text-meta font-medium tracking-kicker text-muted uppercase">
                    {UNIT_LABEL[row.unit]}
                  </span>
                  <span className="font-mono text-row leading-snug font-medium text-foreground tabular-nums">
                    {row.display}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={
                    copied === row.unit
                      ? `Copied ${UNIT_LABEL[row.unit]}`
                      : `Copy ${UNIT_LABEL[row.unit]}`
                  }
                  disabled={row.raw === null}
                  onClick={() => {
                    if (row.raw === null) return;
                    void copyRow(row.unit, formatUnit(row.raw, row.unit));
                  }}
                  className="flex min-h-12 w-11 items-center justify-center text-faint transition-colors duration-150 ease-smooth hover:text-foreground disabled:opacity-40"
                >
                  {copied === row.unit ? (
                    <Check className="size-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <Copy className="size-4" strokeWidth={2} aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="enter-delay-3 mt-6 flex flex-wrap items-end justify-between gap-3 text-meta text-muted">
        <p>1 bit = {SATS_PER_BIT} sats</p>
        {price ? (
          <p>
            Price from{" "}
            <a
              href={price.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-4 transition-colors duration-150 ease-smooth hover:text-foreground"
            >
              {price.source}
            </a>
          </p>
        ) : (
          <p>{priceFailed ? "Public price API unreachable" : "Coinbase · CoinGecko"}</p>
        )}
      </footer>
      <BitsNote open={noteOpen} onClose={() => setNoteOpen(false)} />
    </main>
  );
}

function BitsNote({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="bits-note"
      aria-labelledby="bits-note-title"
      onClose={onClose}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) onClose();
      }}
    >
      <div className="relative pr-10">
        <h2
          id="bits-note-title"
          className="text-kicker font-medium tracking-kicker text-faint uppercase"
        >
          Bits
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 -right-2 flex size-11 items-center justify-center text-faint transition-colors duration-150 ease-smooth hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="mt-4 space-y-3 text-meta leading-normal text-muted">
        <p>
          Bits are Bitcoin written like money. Websites can show ₿12.91 the same
          way they show $12.91.
        </p>
        <p>People bounce on eight-decimal BTC.</p>
        <p>
          One bit is 100 sats. One million bits make one bitcoin. When bitcoin is
          $1,000,000, one bit is $1.
        </p>
      </div>
    </dialog>
  );
}

function UnitSwitch({
  value,
  onChange,
}: {
  value: Unit;
  onChange: (unit: Unit) => void;
}) {
  const groupId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<Unit, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState({ left: 4, width: 0 });

  const measure = useCallback(() => {
    const track = trackRef.current;
    const btn = btnRefs.current[value];
    if (!track || !btn) return;
    const trackBox = track.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    setPill({ left: btnBox.left - trackBox.left, width: btnBox.width });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label="Unit"
      className="relative mt-5 grid grid-cols-4 rounded-xl bg-chip p-1"
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1 bottom-1 rounded-lg bg-foreground transition-[left,width] duration-200 ease-smooth motion-reduce:transition-none",
          pill.width === 0 ? "opacity-0" : "opacity-100",
        )}
        style={{ left: pill.left, width: pill.width }}
      />
      {UNITS.map((item) => {
        const selected = item === value;
        return (
          <button
            key={item}
            ref={(node) => {
              btnRefs.current[item] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-labelledby={`${groupId}-${item}`}
            onClick={() => onChange(item)}
            className={cn(
              "relative z-10 min-h-11 rounded-lg px-1 text-meta font-medium tracking-kicker uppercase transition-colors duration-150 ease-smooth",
              selected ? "text-background" : "text-muted hover:text-foreground",
            )}
          >
            <span id={`${groupId}-${item}`}>{UNIT_LABEL[item]}</span>
          </button>
        );
      })}
    </div>
  );
}

function useFitText(wrapRef: RefObject<HTMLDivElement | null>, value: string) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const input = wrap.querySelector("input");
    if (!(input instanceof HTMLInputElement)) return;

    const fit = () => {
      wrap.style.fontSize = "";
      const max = Number.parseFloat(getComputedStyle(wrap).fontSize) || 48;
      const min = 28;
      let size = max;
      wrap.style.fontSize = `${size}px`;
      while (input.scrollWidth > input.clientWidth + 1 && size > min) {
        size -= 2;
        wrap.style.fontSize = `${size}px`;
      }
    };

    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [wrapRef, value]);
}

/**
 * Batch 56 — currency-symbol restoration.
 *
 * A real P6 export can lose every non-ASCII currency symbol: 6WSD21-DP_202409.xer
 * contains "�G" (Pound), "�D" (Yen) and "��" (Euro) because the export wrote those
 * bytes through a UTF-8 pipeline (proved byte by byte in the batch-55 entry). The
 * ASCII symbols ($ R$ $b Gs S/. Bs RUB $U …) always survive, and `curr_short_name`
 * (ISO 4217) always survives, so the ISO code is the authority for the lost ones.
 *
 * Rules kept deliberately narrow, so nothing is ever invented:
 *   1. only a value that actually contains U+FFFD is replaced;
 *   2. only a *symbol* field (curr_symbol / CurrencySymbol) is considered;
 *   3. only when the row carries a known ISO code — otherwise the raw value stays
 *      and is reported as unresolved;
 *   4. the input tables are never mutated.
 *
 * Everything here is pure, so the smoke test can assert it directly.
 */

export const BROKEN_CHAR = "\uFFFD";

const SYMBOL_FIELD_RE = /curr(?:ency)?_?symbol/i;
const CODE_FIELD_RE = /^curr(?:ency)?_?(?:short_?name|code)$/i;

/** ISO 4217 alpha code → symbol (the plain symbol, i.e. what P6's currency table holds). */
export const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "\u20AC", GBP: "\u00A3", JPY: "\u00A5", CNY: "\u00A5",
  CHF: "CHF", CAD: "$", AUD: "$", NZD: "$", HKD: "HK$", SGD: "S$", TWD: "NT$",
  KRW: "\u20A9", INR: "\u20B9", PKR: "\u20A8", BDT: "\u09F3", LKR: "Rs", NPR: "\u20A8",
  MYR: "RM", IDR: "Rp", PHP: "\u20B1", THB: "\u0E3F", VND: "\u20AB", MMK: "K",
  KHR: "\u17DB", LAK: "\u20AD", MNT: "\u20AE", KZT: "\u20B8", AZN: "\u20BC",
  GEL: "\u20BE", AMD: "\u058F", TRY: "\u20BA", ILS: "\u20AA", AED: "\u062F.\u0625",
  SAR: "\uFDFC", QAR: "\uFDFC", KWD: "\u062F.\u0643", EGP: "\u00A3", MAD: "\u062F.\u0645.",
  NGN: "\u20A6", GHS: "\u20B5", KES: "KSh", TZS: "TSh", UGX: "USh", ZAR: "R",
  BWP: "P", ZMW: "ZK", MZN: "MT", AOA: "Kz", XOF: "CFA", XAF: "FCFA", ETB: "Br",
  SEK: "kr", NOK: "kr", DKK: "kr", ISK: "kr", PLN: "z\u0142", CZK: "K\u010D",
  HUF: "Ft", RON: "lei", BGN: "\u043B\u0432", HRK: "kn", RSD: "\u0434\u0438\u043D",
  BAM: "KM", ALL: "L", MDL: "L", UAH: "\u20B4", BYN: "Br", RUB: "\u20BD", KGS: "\u0441",
  BRL: "R$", ARS: "$", CLP: "$", COP: "$", PEN: "S/.", UYU: "$U", PYG: "\u20B2",
  BOB: "Bs", VEF: "Bs.F", VES: "Bs.F", GYD: "$", SRD: "$", JMD: "J$", TTD: "TT$",
  BBD: "$", BSD: "$", BZD: "BZ$", DOP: "RD$", CUP: "$", GTQ: "Q", HNL: "L",
  NIO: "C$", CRC: "\u20A1", PAB: "B/.", MXN: "$",
};

/**
 * The symbol for an ISO 4217 code ("" when the code is unknown, so callers never
 * receive a fabricated glyph). `XXX` (\"no currency\") is intentionally unmapped.
 */
export function currencySymbolFor(code) {
  const key = String(code == null ? "" : code).trim().toUpperCase();
  if (!key) return "";
  return CURRENCY_SYMBOLS[key] || CURRENCY_SYMBOLS[key.slice(0, 3)] || "";
}

/** The ISO code carried by a currency row (XER `curr_short_name`, P6 XML `CurrencyCode`). */
export function currencyCodeOf(row) {
  for (const [field, value] of Object.entries(row || {})) {
    if (!CODE_FIELD_RE.test(field)) continue;
    const code = String(value == null ? "" : value).trim().toUpperCase();
    if (code) return code;
  }
  return "";
}

/** True when a value still carries characters the file could not decode. */
export function isBrokenValue(value) {
  return typeof value === "string" && value.includes(BROKEN_CHAR);
}

/**
 * Restore the currency symbols of a tables object.
 *
 * Returns `{ tables, restored, unresolved }` where `tables` is a new object when at
 * least one value was restored (otherwise the original, so downstream memos stay
 * cheap), `restored` lists `{ table, field, rowIndex, code, from, to }` and
 * `unresolved` the broken values no ISO code could answer for.
 */
export function restoreCurrencySymbols(tables) {
  if (!tables || typeof tables !== "object") return { tables: tables ?? null, restored: [], unresolved: [] };

  const restored = [];
  const unresolved = [];
  const out = {};

  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) { out[table] = rows; continue; }
    let changed = false;
    const nextRows = rows.map((row, rowIndex) => {
      let next = null;
      for (const [field, value] of Object.entries(row || {})) {
        if (!SYMBOL_FIELD_RE.test(field) || !isBrokenValue(value)) continue;
        const code = currencyCodeOf(row);
        const symbol = currencySymbolFor(code);
        const entry = { table, field, rowIndex, code, from: value, to: symbol };
        if (!symbol) { unresolved.push(entry); continue; }
        next = next || { ...row };
        next[field] = symbol;
        restored.push(entry);
        changed = true;
      }
      return next || row;
    });
    out[table] = changed ? nextRows : rows;
  }

  return { tables: restored.length ? out : tables, restored, unresolved };
}

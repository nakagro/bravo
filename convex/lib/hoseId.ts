// Brigade hose IDs are two letters then four digits, e.g. WV3502. Shared by the
// `add` mutation and the hose form so both apply the same rule.
export const HOSE_ID_PATTERN = /^[A-Z]{2}\d{4}$/;

export const HOSE_ID_FORMAT_MESSAGE =
  "Hose ID must be two letters then four digits, e.g. WV3502";

/** Trims and uppercases, so "wv 3502 " and "WV3502" are the same hose. */
export function normaliseHoseId(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidHoseId(raw: string): boolean {
  return HOSE_ID_PATTERN.test(normaliseHoseId(raw));
}

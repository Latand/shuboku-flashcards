/*
 * Reading a store back out of a half-overwritten cloud dump.
 *
 * The cloud holds the store as a plain JSON string cut into numbered chunks.
 * A device that lost its browser storage writes a small fresh store over the
 * first few of them and moves sb_n down, but never deletes the rest — so the
 * chunks above the new count are still the tail of the old, larger store.
 *
 * That tail is not valid JSON: it starts mid-object and has no opening brace.
 * What it does still contain, verbatim, is the per-card repetition state, and
 * that is the part worth years of reviews. So the tail is scanned for
 * "<card id>": { ... } pairs with balanced braces and each one is parsed on
 * its own; anything that does not look like card state is dropped.
 */
import type { CardState } from "./scheduler";

/** The contiguous run of chunks that belongs to the older, larger store. */
export function assembleTail(
  parts: Record<number, string>,
  declared: number | null
): { text: string; from: number; to: number } | null {
  const present = Object.keys(parts)
    .map(Number)
    .sort((a, b) => a - b);
  if (!present.length) return null;

  // Everything below the declared count was rewritten by the small store.
  const start = declared != null && declared > 0 ? declared : 0;
  const tail = present.filter((i) => i >= start);
  if (!tail.length) return null;

  // Stop at the first hole: past it the text no longer joins up.
  let to = tail[0];
  for (const i of tail) {
    if (i === to || i === to + 1) to = i;
    else break;
  }
  let text = "";
  for (let i = tail[0]; i <= to; i++) text += parts[i];
  return { text, from: tail[0], to };
}

/** Does this parsed object carry the fields a scheduled card must have? */
function looksLikeCardState(v: unknown): v is CardState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.interval === "number" &&
    typeof o.timeToReview === "number" &&
    typeof o.totalRepetitions === "number" &&
    typeof o.retired === "boolean"
  );
}

/**
 * Every `"key": { ... }` pair in the text whose value parses as card state.
 *
 * Written as a scanner rather than a regular expression because card state
 * nests: `history` is an array of objects, so the closing brace has to be
 * found by counting, and strings inside can hold braces of their own.
 */
export function salvageCards(text: string): Record<string, CardState> {
  const out: Record<string, CardState> = {};
  let i = 0;

  while (i < text.length) {
    // find a "…": { that could open a card entry
    const quote = text.indexOf('"', i);
    if (quote < 0) break;
    const end = findStringEnd(text, quote);
    if (end < 0) break;
    const key = text.slice(quote + 1, end);
    let j = end + 1;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== ":") {
      // The dump starts mid-string, so quote parity cannot be assumed: every
      // quote has to be tried as a possible opener, or a wrong guess early on
      // hides every real key that follows.
      i = quote + 1;
      continue;
    }
    j++;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] !== "{") {
      i = quote + 1;
      continue;
    }

    const close = matchBrace(text, j);
    if (close < 0) break; // truncated at the very end of the dump
    try {
      const value: unknown = JSON.parse(text.slice(j, close + 1));
      if (looksLikeCardState(value)) out[unescapeKey(key)] = value;
    } catch {
      /* a fragment that only looked like an object */
    }
    i = close + 1;
  }
  return out;
}

/** Index of the closing quote of the string starting at `start`. */
function findStringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === '"') return i;
  }
  return -1;
}

/** Index of the brace closing the one at `open`, or -1 if the text runs out. */
function matchBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const end = findStringEnd(text, i);
      if (end < 0) return -1;
      i = end;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return -1;
}

/** JSON keys arrive escaped; card ids hold kana, so decode them properly. */
function unescapeKey(key: string): string {
  try {
    return JSON.parse(`"${key}"`) as string;
  } catch {
    return key;
  }
}

/**
 * The review log, lifted whole out of the dump.
 *
 * The streak and the stats bars are counted from `reviewLog`, never from the
 * cards — and per-card `history` cannot stand in for it, because it only keeps
 * the last two dozen grades. Luckily `reviewLog` is serialised after `cards`,
 * so on a store of any size it lands well inside the surviving tail: the
 * streak comes back even though the head that held `collection` is gone.
 */
export function salvageReviewLog(text: string): Record<string, number> {
  let best: Record<string, number> = {};
  let at = text.indexOf('"reviewLog"');

  // A store can hold several profiles, and the tail names each one's log. The
  // restore folds everything into the active profile, so take the fullest.
  while (at >= 0) {
    let j = at + '"reviewLog"'.length;
    while (j < text.length && /\s/.test(text[j])) j++;
    if (text[j] === ":") {
      j++;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "{") {
        const close = matchBrace(text, j);
        if (close >= 0) {
          const log = asReviewLog(text.slice(j, close + 1));
          if (log && Object.keys(log).length > Object.keys(best).length) best = log;
        }
      }
    }
    at = text.indexOf('"reviewLog"', at + 1);
  }
  return best;
}

/** Parsed only if every entry is a 'YYYY-MM-DD' day with a positive count. */
function asReviewLog(json: string): Record<string, number> | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const out: Record<string, number> = {};
  for (const [day, count] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
    out[day] = count;
  }
  return out;
}

/**
 * Which decks the salvaged cards came from.
 *
 * The collection list sits near the top of the store, so a lost head takes it
 * with it — but a card id says which pack it belongs to, and the packs are
 * built into the app. Studied cards alone count: a deck is in the collection
 * because it was worked on, not because one of its cards happens to appear.
 */
export function decksForCards(
  cards: Record<string, CardState>,
  decks: readonly { id: string; cards: readonly { id: string }[] }[]
): string[] {
  const studied = new Set(
    Object.entries(cards)
      .filter(([, s]) => s.totalRepetitions > 0)
      .map(([id]) => id)
  );
  return decks.filter((d) => d.cards.some((c) => studied.has(c.id))).map((d) => d.id);
}

export interface SalvageSummary {
  cards: Record<string, CardState>;
  /** how many carry at least one real review */
  studied: number;
  retired: number;
  /** epoch ms of the earliest and latest review found, when there is one */
  firstReview: number | null;
  lastReview: number | null;
  reviews: number;
  /** the recovered day → reviews log the streak is counted from */
  reviewLog: Record<string, number>;
  /** days the log has a review on */
  studyDays: number;
}

export function summarizeSalvage(
  cards: Record<string, CardState>,
  reviewLog: Record<string, number> = {}
): SalvageSummary {
  let studied = 0;
  let retired = 0;
  let reviews = 0;
  let firstReview: number | null = null;
  let lastReview: number | null = null;

  for (const state of Object.values(cards)) {
    if (state.totalRepetitions > 0) studied++;
    if (state.retired) retired++;
    reviews += state.totalRepetitions;
    for (const entry of state.history ?? []) {
      if (firstReview == null || entry.at < firstReview) firstReview = entry.at;
      if (lastReview == null || entry.at > lastReview) lastReview = entry.at;
    }
  }
  return {
    cards,
    studied,
    retired,
    reviews,
    firstReview,
    lastReview,
    reviewLog,
    studyDays: Object.keys(reviewLog).length,
  };
}

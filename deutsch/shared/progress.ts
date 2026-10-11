/*
 * Learner progress and the rule for merging two copies of it.
 *
 * Shared by the Mini App and by whatever stores progress remotely, so it
 * imports nothing at runtime. `CardState` is a type-only import and vanishes
 * from the compiled output.
 *
 * Every key is merged on its own and the newer value wins, which makes the
 * merge a per-key maximum under a total order: it is commutative,
 * idempotent and associative, and no key ever disappears. A device that starts
 * from empty storage therefore cannot erase progress held elsewhere.
 */

import type { CardState, Grade } from "../../src/lib/scheduler";

export type Direction = "de-uk" | "uk-de";

/** `at` is the epoch ms of the change; 0 marks an untouched default. */
export interface PackFlag {
  on: boolean;
  at: number;
}

export interface Progress {
  version: 1;
  /** packId → added / removed */
  packs: Record<string, PackFlag>;
  /** cardId → FSRS state; an entry appears with the first grade */
  cards: Record<string, CardState>;
  settings: { direction: Direction; at: number };
}

/** Packs a new learner starts with: the pronouns and `sein` from the school worksheet. */
export const DEFAULT_PACKS: readonly string[] = ["pronomen", "sein"];

export const MAX_CARDS = 2000;
export const MAX_PACKS = 200;
const MAX_HISTORY = 50;
const MAX_INTERVAL_DAYS = 36_500;
const MAX_FUTURE_SKEW_MS = 30 * 86_400_000;
const KEY_RE = /^[a-z0-9-]{1,40}$/;
const CARD_RE = /^[a-z0-9-]{1,40}:[a-z0-9-]{1,60}$/;

export function emptyProgress(): Progress {
  return {
    version: 1,
    packs: Object.fromEntries(DEFAULT_PACKS.map((id) => [id, { on: true, at: 0 }])),
    cards: {},
    settings: { direction: "de-uk", at: 0 },
  };
}

/** Whether a pack is on; a pack nobody touched follows the defaults. */
export function isPackOn(p: Progress, packId: string): boolean {
  const flag = p.packs[packId];
  return flag ? flag.on : DEFAULT_PACKS.includes(packId);
}

/** When a card was last graded: the newest history entry, else `lastReview`, else 0. */
export function cardChangedAt(s: CardState): number {
  const last = s.history?.length ? s.history[s.history.length - 1]!.at : 0;
  return Math.max(last, s.lastReview ?? 0);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** JSON with sorted keys, so equal states compare equal whatever order they were built in. */
function canonical(x: unknown): string {
  return JSON.stringify(x, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([p], [q]) => compareStrings(p, q)))
      : v
  );
}

/** Positive when `x` is the newer card state; 0 only for identical states. */
function compareCards(x: CardState, y: CardState): number {
  return (
    cardChangedAt(x) - cardChangedAt(y) ||
    x.totalRepetitions - y.totalRepetitions ||
    compareStrings(canonical(x), canonical(y))
  );
}

function mergeCards(a: Record<string, CardState>, b: Record<string, CardState>) {
  const out: Record<string, CardState> = { ...a };
  for (const [id, state] of Object.entries(b)) {
    const mine = out[id];
    out[id] = mine && compareCards(mine, state) >= 0 ? mine : state;
  }
  return out;
}

function mergePacks(a: Record<string, PackFlag>, b: Record<string, PackFlag>) {
  const out: Record<string, PackFlag> = { ...a };
  for (const [id, flag] of Object.entries(b)) {
    const mine = out[id];
    if (!mine || flag.at > mine.at || (flag.at === mine.at && flag.on && !mine.on)) out[id] = flag;
  }
  return out;
}

function mergeSettings(a: Progress["settings"], b: Progress["settings"]): Progress["settings"] {
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return compareStrings(a.direction, b.direction) >= 0 ? a : b;
}

export function mergeProgress(a: Progress | null, b: Progress): Progress {
  if (!a) return b;
  return {
    version: 1,
    packs: mergePacks(a.packs, b.packs),
    cards: mergeCards(a.cards, b.cards),
    settings: mergeSettings(a.settings, b.settings),
  };
}

/* ---- validation (localStorage and anything arriving over the wire) ---- */

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 100_000;
const isGrade = (x: unknown): x is Grade => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6;
const isEventTime = (x: unknown): x is number =>
  Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= Date.now() + MAX_FUTURE_SKEW_MS;
const isScheduledTime = (x: unknown): x is number =>
  Number.isSafeInteger(x) && (x as number) >= 0 &&
  (x as number) <= Date.now() + MAX_FUTURE_SKEW_MS + (MAX_INTERVAL_DAYS + 1) * 86_400_000;

function isHistory(x: unknown): x is { at: number; grade: Grade }[] {
  if (!Array.isArray(x)) return false;
  for (const item of x) {
    if (!isRecord(item) || !isEventTime(item.at) || !isGrade(item.grade)) return false;
  }
  return true;
}

function parseCard(x: unknown): CardState | null {
  if (!isRecord(x)) return null;
  if (!isCount(x.nRepetitions) || !isCount(x.totalRepetitions) || x.nRepetitions > x.totalRepetitions) return null;
  if (!isNum(x.interval) || x.interval < 0 || x.interval > MAX_INTERVAL_DAYS) return null;
  if (!isEventTime(x.intervalStart) || !isScheduledTime(x.timeToReview) || typeof x.retired !== "boolean") return null;
  if (!isNum(x.easinessFactor) || x.easinessFactor < 1.3 || x.easinessFactor > 3.5) return null;
  if (x.lastGrade !== null && !isGrade(x.lastGrade)) return null;
  if (x.schedulerVersion !== undefined && x.schedulerVersion !== 1) return null;
  if (x.schedulerVersion === 1) {
    if (x.stability !== undefined && (!isNum(x.stability) || x.stability < 0 || x.stability > MAX_INTERVAL_DAYS)) return null;
    if (x.difficulty !== undefined && (!isNum(x.difficulty) || x.difficulty < 0 || x.difficulty > 10)) return null;
    if (x.lapses !== undefined && !isCount(x.lapses)) return null;
    if (x.lastReview !== null && !isEventTime(x.lastReview)) return null;
  }
  if (x.history !== undefined && !isHistory(x.history)) return null;
  const history = (x.history as { at: number; grade: Grade }[] | undefined)?.slice(-MAX_HISTORY) ?? [];
  const maxScheduledAt = x.intervalStart + (MAX_INTERVAL_DAYS + 1) * 86_400_000;
  if (x.timeToReview > maxScheduledAt) return null;

  const card: CardState = {
    nRepetitions: x.nRepetitions,
    easinessFactor: x.easinessFactor,
    interval: x.interval,
    intervalStart: x.intervalStart,
    timeToReview: x.timeToReview,
    totalRepetitions: x.totalRepetitions,
    lastGrade: x.lastGrade,
    history,
    retired: x.retired,
  };
  if (x.schedulerVersion === 1) {
    card.schedulerVersion = 1;
    if (isNum(x.stability)) card.stability = x.stability;
    if (isNum(x.difficulty)) card.difficulty = x.difficulty;
    if (isNum(x.lapses)) card.lapses = x.lapses;
    card.lastReview = x.lastReview as number | null;
  }
  return card;
}

/**
 * Accepts anything; returns a clean Progress or null when `x` is not a
 * version-1 progress object. Broken packs and cards are dropped one by one so
 * a single bad entry never costs the rest.
 */
export function parseProgress(x: unknown): Progress | null {
  if (!isRecord(x) || x.version !== 1) return null;

  const packs: Record<string, PackFlag> = {};
  if (isRecord(x.packs)) {
    for (const [id, flag] of Object.entries(x.packs).slice(0, MAX_PACKS)) {
      if (KEY_RE.test(id) && isRecord(flag) && typeof flag.on === "boolean" && isEventTime(flag.at)) {
        packs[id] = { on: flag.on, at: flag.at };
      }
    }
  }

  const cards: Record<string, CardState> = {};
  if (isRecord(x.cards)) {
    for (const [id, raw] of Object.entries(x.cards).slice(0, MAX_CARDS)) {
      if (!CARD_RE.test(id)) continue;
      const card = parseCard(raw);
      if (card) cards[id] = card;
    }
  }

  let settings: Progress["settings"] = { direction: "de-uk", at: 0 };
  if (isRecord(x.settings) && isEventTime(x.settings.at)) {
    const d = x.settings.direction;
    if (d === "de-uk" || d === "uk-de") settings = { direction: d, at: x.settings.at };
  }

  return { version: 1, packs, cards, settings };
}

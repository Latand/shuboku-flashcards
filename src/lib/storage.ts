import type { Card } from "../data/packs";
import { BUILTIN_BY_ID, BUILTIN_DECKS } from "../data/packs";
import {
  DAY_MS,
  DEFAULT_DESIRED_RETENTION,
  MAX_DESIRED_RETENTION,
  MIN_DESIRED_RETENTION,
  newCardState,
  type CardState,
  type Grade,
} from "./scheduler";

export const STORE_KEY = "shuboku:v2";
export const LEGACY_KEY = "shuboku:v1:progress";

export interface CustomDeckDef {
  id: string;
  name: string;
  cardIds: string[];
}

export interface Settings {
  reverse: boolean;
  autoSound: boolean;
  /** session cap; 0 = no cap */
  limit: number;
  /** reveal the answer automatically after 60 s (the bot flipped stale cards) */
  autoFlip: boolean;
  /** target probability of recall when a card becomes due */
  desiredRetention: number;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: number;
  /** deck ids (built-in pack ids + this profile's custom deck ids) in the collection */
  collection: string[];
  /** collected decks whose learning is paused (the bot's UserBlock.active = false) */
  paused: string[];
  /** per-card repetition state, kept even when a pack leaves the collection */
  cards: Record<string, CardState>;
  customCards: Record<string, Card>;
  customDecks: Record<string, CustomDeckDef>;
  /** 'YYYY-MM-DD' → number of reviews that day */
  reviewLog: Record<string, number>;
  /** recent successful recall pauses in ms — the baseline for grade suggestions */
  recallTimes: number[];
  settings: Settings;
}

export interface Store {
  version: 2;
  activeProfileId: string;
  profiles: Record<string, Profile>;
  /** epoch ms of the last save — used to pick the newer copy between devices */
  savedAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  reverse: false,
  autoSound: true,
  limit: 20,
  autoFlip: false,
  desiredRetention: DEFAULT_DESIRED_RETENTION,
};

export function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function newProfile(name: string, now: number): Profile {
  return {
    id: uid(),
    name,
    createdAt: now,
    collection: [],
    paused: [],
    cards: {},
    customCards: {},
    customDecks: {},
    reviewLog: {},
    recallTimes: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newStore(now: number): Store {
  const profile = newProfile("Default", now);
  return { version: 2, activeProfileId: profile.id, profiles: { [profile.id]: profile } };
}

/* ---- migration from the artifact's Leitner data ---- */

interface LegacyEntry {
  box: number;
  seen: number;
  right: number;
}

/** Rough Leitner box → SM-2 interval mapping so early users lose nothing. */
const BOX_TO_INTERVAL = [0, 1, 3, 7, 14, 30];

export function migrateLegacyProgress(
  legacy: Record<string, LegacyEntry>,
  profile: Profile,
  now: number
): void {
  const cardToDeck: Record<string, string> = {};
  for (const deck of BUILTIN_DECKS)
    for (const card of deck.cards) cardToDeck[card.id] = deck.id;

  for (const [cardId, entry] of Object.entries(legacy)) {
    const deckId = cardToDeck[cardId];
    if (!deckId) continue; // card no longer exists in the catalog
    const box = Math.max(0, Math.min(5, entry.box | 0));
    const interval = BOX_TO_INTERVAL[box];
    const state = newCardState(now);
    state.nRepetitions = box;
    state.interval = interval;
    state.timeToReview = now + interval * DAY_MS;
    state.totalRepetitions = Math.max(0, entry.seen | 0);
    profile.cards[cardId] = state;
    if (!profile.collection.includes(deckId)) profile.collection.push(deckId);
  }

  // Cards of a collected pack the user never saw still need state, or they
  // would never enter the review queue.
  for (const deckId of profile.collection) {
    const deck = BUILTIN_DECKS.find((d) => d.id === deckId);
    for (const card of deck?.cards ?? []) {
      if (!profile.cards[card.id]) profile.cards[card.id] = newCardState(now);
    }
  }
}

/* ---- load / save ---- */

/** Fill in fields added after the first v2 release (paused decks, new settings). */
export function normalizeStore(store: Store): Store {
  const now = Date.now();
  for (const id of Object.keys(store.profiles)) {
    const p: Profile = {
      ...store.profiles[id],
      paused: store.profiles[id].paused ?? [],
      recallTimes: (store.profiles[id].recallTimes ?? []).filter(
        (ms) => typeof ms === "number" && Number.isFinite(ms)
      ),
      settings: { ...DEFAULT_SETTINGS, ...store.profiles[id].settings },
    };
    const desiredRetention = p.settings.desiredRetention;
    p.settings.desiredRetention =
      typeof desiredRetention === "number" && Number.isFinite(desiredRetention)
        ? Math.min(MAX_DESIRED_RETENTION, Math.max(MIN_DESIRED_RETENTION, desiredRetention))
        : DEFAULT_DESIRED_RETENTION;
    // Invariant: every card of a collected deck has repetition state,
    // otherwise it could never become due.
    for (const deckId of p.collection) {
      const cardIds =
        deckId in BUILTIN_BY_ID
          ? BUILTIN_BY_ID[deckId].cards.map((c) => c.id)
          : (p.customDecks[deckId]?.cardIds ?? []);
      for (const cardId of cardIds) {
        if (!p.cards[cardId]) {
          p.cards = { ...p.cards, [cardId]: newCardState(now) };
        }
      }
    }
    store.profiles[id] = p;
  }
  return store;
}

export function loadStore(now: number): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed && parsed.version === 2 && parsed.profiles[parsed.activeProfileId]) {
        return normalizeStore(parsed);
      }
    }
  } catch {
    /* corrupted store — fall through to a fresh one */
  }

  const store = newStore(now);
  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      migrateLegacyProgress(
        JSON.parse(legacyRaw),
        store.profiles[store.activeProfileId],
        now
      );
    }
  } catch {
    /* unreadable legacy data — start clean */
  }
  return store;
}

export function saveStore(store: Store): string {
  const json = JSON.stringify({ ...store, savedAt: Date.now() });
  try {
    localStorage.setItem(STORE_KEY, json);
  } catch {
    /* storage full or unavailable — the session still works in memory */
  }
  return json;
}

/* ---- export / import ---- */

export function exportStore(store: Store): string {
  return JSON.stringify(store, null, 2);
}

export function parseImport(json: string): Store {
  const parsed = JSON.parse(json) as Store;
  if (!parsed || parsed.version !== 2 || typeof parsed.profiles !== "object") {
    throw new Error("Not a Shuboku v2 export");
  }
  if (!parsed.profiles[parsed.activeProfileId]) {
    const first = Object.keys(parsed.profiles)[0];
    if (!first) throw new Error("Export contains no profiles");
    parsed.activeProfileId = first;
  }
  return normalizeStore(parsed);
}

/* ---- helpers used by the app ---- */

export function todayKey(now: number): string {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function logReview(profile: Profile, now: number): void {
  const key = todayKey(now);
  profile.reviewLog[key] = (profile.reviewLog[key] ?? 0) + 1;
}

export type { CardState, Grade };

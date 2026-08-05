import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BUILTIN_BY_ID, BUILTIN_DECKS, type Card, type Deck } from "./data/packs";
import { isDue, newCardState, review, type CardState, type Grade } from "./lib/sm2";
import {
  loadStore,
  logReview,
  newProfile,
  parseImport,
  saveStore,
  uid,
  type Profile,
  type Settings,
  type Store,
} from "./lib/storage";

export interface AppApi {
  store: Store;
  profile: Profile;
  /** all decks visible to the active profile (built-in catalog + own custom decks) */
  decks: Deck[];
  /** decks currently in the collection */
  collectedDecks: Deck[];
  /** collected decks that are not paused — these feed reviews and reminders */
  activeDecks: Deck[];
  cardsById: Record<string, Card>;
  deckById: Record<string, Deck>;
  dueCount: (deckId: string, now: number) => number;
  cardState: (cardId: string) => CardState | undefined;

  addToCollection: (deckId: string) => void;
  removeFromCollection: (deckId: string) => void;
  /** the bot's "pause block learning": keep the deck, skip its reviews */
  togglePaused: (deckId: string) => void;
  gradeCard: (cardId: string, grade: Grade, now: number) => CardState;
  setRetired: (cardId: string, retired: boolean) => void;

  createCustomDeck: (name: string) => string;
  renameCustomDeck: (deckId: string, name: string) => void;
  deleteCustomDeck: (deckId: string) => void;
  addCustomCard: (
    deckId: string,
    card: { front: string; back: string; reading?: string; note?: string }
  ) => void;
  updateCustomCard: (
    cardId: string,
    card: { front: string; back: string; reading?: string; note?: string }
  ) => void;
  deleteCustomCard: (deckId: string, cardId: string) => void;

  setSettings: (patch: Partial<Settings>) => void;

  switchProfile: (profileId: string) => void;
  createProfile: (name: string) => void;
  renameProfile: (profileId: string, name: string) => void;
  deleteProfile: (profileId: string) => void;

  exportJson: () => string;
  importJson: (json: string) => void;
  resetProfileProgress: () => void;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useApp outside provider");
  return api;
}

function customDeckToDeck(profile: Profile, deckId: string): Deck | null {
  const def = profile.customDecks[deckId];
  if (!def) return null;
  return {
    id: def.id,
    script: "custom",
    jp: def.name,
    name: "Custom deck",
    builtin: false,
    cards: def.cardIds
      .map((id) => profile.customCards[id])
      .filter((c): c is Card => !!c),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => loadStore(Date.now()));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveStore(store), 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store]);

  const profile = store.profiles[store.activeProfileId];

  const patchProfile = useCallback((fn: (p: Profile) => void) => {
    setStore((prev) => {
      const cur = prev.profiles[prev.activeProfileId];
      const next: Profile = {
        ...cur,
        collection: [...cur.collection],
        paused: [...cur.paused],
        cards: { ...cur.cards },
        customCards: { ...cur.customCards },
        customDecks: { ...cur.customDecks },
        reviewLog: { ...cur.reviewLog },
        settings: { ...cur.settings },
      };
      fn(next);
      return { ...prev, profiles: { ...prev.profiles, [next.id]: next } };
    });
  }, []);

  const decks = useMemo<Deck[]>(() => {
    const custom = Object.keys(profile.customDecks)
      .map((id) => customDeckToDeck(profile, id))
      .filter((d): d is Deck => !!d);
    return [...BUILTIN_DECKS, ...custom];
  }, [profile]);

  const deckById = useMemo(
    () => Object.fromEntries(decks.map((d) => [d.id, d])),
    [decks]
  );

  const collectedDecks = useMemo(
    () => profile.collection.map((id) => deckById[id]).filter((d): d is Deck => !!d),
    [profile.collection, deckById]
  );

  const activeDecks = useMemo(
    () => collectedDecks.filter((d) => !profile.paused.includes(d.id)),
    [collectedDecks, profile.paused]
  );

  // Reminder equivalent of the bot's cron ping: keep the due count in the tab title.
  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const due = activeDecks.reduce(
        (a, d) => a + d.cards.filter((c) => isDue(profile.cards[c.id], now)).length,
        0
      );
      document.title = due > 0 ? `(${due}) 朱墨 Shuboku` : "朱墨 Shuboku — Japanese flashcards";
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [activeDecks, profile.cards]);

  const cardsById = useMemo(() => {
    const m: Record<string, Card> = {};
    for (const d of decks) for (const c of d.cards) m[c.id] = c;
    return m;
  }, [decks]);

  const api: AppApi = {
    store,
    profile,
    decks,
    collectedDecks,
    activeDecks,
    cardsById,
    deckById,

    dueCount: (deckId, now) => {
      const deck = deckById[deckId];
      if (!deck) return 0;
      return deck.cards.filter((c) => isDue(profile.cards[c.id], now)).length;
    },

    cardState: (cardId) => profile.cards[cardId],

    addToCollection: (deckId) =>
      patchProfile((p) => {
        if (!p.collection.includes(deckId)) p.collection.push(deckId);
        const deck = deckId in BUILTIN_BY_ID ? BUILTIN_BY_ID[deckId] : customDeckToDeck(p, deckId);
        const now = Date.now();
        // Repetition history survives remove/re-add; only unseen cards start fresh.
        for (const c of deck?.cards ?? []) {
          if (!p.cards[c.id]) p.cards[c.id] = newCardState(now);
        }
      }),

    removeFromCollection: (deckId) =>
      patchProfile((p) => {
        p.collection = p.collection.filter((id) => id !== deckId);
        p.paused = p.paused.filter((id) => id !== deckId);
      }),

    togglePaused: (deckId) =>
      patchProfile((p) => {
        p.paused = p.paused.includes(deckId)
          ? p.paused.filter((id) => id !== deckId)
          : [...p.paused, deckId];
      }),

    gradeCard: (cardId, grade, now) => {
      const next = review(profile.cards[cardId] ?? newCardState(now), grade, now);
      patchProfile((p) => {
        p.cards[cardId] = next;
        logReview(p, now);
      });
      return next;
    },

    setRetired: (cardId, retired) =>
      patchProfile((p) => {
        const cur = p.cards[cardId] ?? newCardState(Date.now());
        p.cards[cardId] = {
          ...cur,
          retired,
          // un-retiring makes the card due again right away
          timeToReview: retired ? cur.timeToReview : Date.now(),
        };
      }),

    createCustomDeck: (name) => {
      const id = "custom-deck:" + uid();
      patchProfile((p) => {
        p.customDecks[id] = { id, name, cardIds: [] };
      });
      return id;
    },

    renameCustomDeck: (deckId, name) =>
      patchProfile((p) => {
        const d = p.customDecks[deckId];
        if (d) p.customDecks[deckId] = { ...d, name };
      }),

    deleteCustomDeck: (deckId) =>
      patchProfile((p) => {
        const d = p.customDecks[deckId];
        if (!d) return;
        for (const cardId of d.cardIds) delete p.customCards[cardId];
        delete p.customDecks[deckId];
        p.collection = p.collection.filter((id) => id !== deckId);
      }),

    addCustomCard: (deckId, card) =>
      patchProfile((p) => {
        const d = p.customDecks[deckId];
        if (!d) return;
        const id = "custom:" + uid();
        p.customCards[id] = {
          id,
          type: "custom",
          char: card.front,
          back: card.back,
          reading: card.reading || undefined,
          note: card.note || undefined,
          speak: card.reading || card.front,
        };
        p.customDecks[deckId] = { ...d, cardIds: [...d.cardIds, id] };
        // If the deck is already collected, the new card enters rotation now.
        if (p.collection.includes(deckId) && !p.cards[id]) {
          p.cards[id] = newCardState(Date.now());
        }
      }),

    updateCustomCard: (cardId, card) =>
      patchProfile((p) => {
        const cur = p.customCards[cardId];
        if (!cur) return;
        p.customCards[cardId] = {
          ...cur,
          char: card.front,
          back: card.back,
          reading: card.reading || undefined,
          note: card.note || undefined,
          speak: card.reading || card.front,
        };
      }),

    deleteCustomCard: (deckId, cardId) =>
      patchProfile((p) => {
        const d = p.customDecks[deckId];
        if (!d) return;
        p.customDecks[deckId] = { ...d, cardIds: d.cardIds.filter((id) => id !== cardId) };
        delete p.customCards[cardId];
        delete p.cards[cardId];
      }),

    setSettings: (patch) =>
      patchProfile((p) => {
        p.settings = { ...p.settings, ...patch };
      }),

    switchProfile: (profileId) =>
      setStore((prev) =>
        prev.profiles[profileId] ? { ...prev, activeProfileId: profileId } : prev
      ),

    createProfile: (name) =>
      setStore((prev) => {
        const p = newProfile(name, Date.now());
        return {
          ...prev,
          activeProfileId: p.id,
          profiles: { ...prev.profiles, [p.id]: p },
        };
      }),

    renameProfile: (profileId, name) =>
      setStore((prev) => {
        const p = prev.profiles[profileId];
        if (!p) return prev;
        return { ...prev, profiles: { ...prev.profiles, [profileId]: { ...p, name } } };
      }),

    deleteProfile: (profileId) =>
      setStore((prev) => {
        const ids = Object.keys(prev.profiles);
        if (ids.length <= 1 || !prev.profiles[profileId]) return prev;
        const profiles = { ...prev.profiles };
        delete profiles[profileId];
        const activeProfileId =
          prev.activeProfileId === profileId ? Object.keys(profiles)[0] : prev.activeProfileId;
        return { ...prev, profiles, activeProfileId };
      }),

    exportJson: () => JSON.stringify(store, null, 2),

    importJson: (json) => {
      const parsed = parseImport(json);
      setStore(parsed);
      saveStore(parsed);
    },

    resetProfileProgress: () =>
      patchProfile((p) => {
        p.cards = {};
        p.reviewLog = {};
        // Collected decks start over as brand-new cards, due immediately.
        const now = Date.now();
        for (const deckId of p.collection) {
          const deck =
            deckId in BUILTIN_BY_ID ? BUILTIN_BY_ID[deckId] : customDeckToDeck(p, deckId);
          for (const c of deck?.cards ?? []) p.cards[c.id] = newCardState(now);
        }
      }),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

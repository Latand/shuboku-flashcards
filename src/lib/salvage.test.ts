import { describe, expect, test } from "bun:test";
import {
  assembleTail,
  decksForCards,
  salvageCards,
  salvageReviewLog,
  summarizeSalvage,
} from "./salvage";
import { splitChunks } from "./telegram";
import { computeStreak } from "./insights";

/** A store shaped like the real one, big enough to span several chunks. */
function makeStore(cardCount: number) {
  const cards: Record<string, unknown> = {};
  for (let i = 0; i < cardCount; i++) {
    cards[`hiragana:あ${i}:a${i}`] = {
      schedulerVersion: 1,
      stability: 12.5,
      difficulty: 5 + (i % 5),
      lapses: i % 3,
      lastReview: 1_700_000_000_000 + i * 1000,
      nRepetitions: 3,
      easinessFactor: 2.5,
      interval: 12,
      intervalStart: 1_700_000_000_000,
      timeToReview: 1_800_000_000_000 + i,
      totalRepetitions: 4,
      lastGrade: 4,
      history: [
        { at: 1_600_000_000_000 + i, grade: 2 },
        { at: 1_700_000_000_000 + i, grade: 5 },
      ],
      retired: i % 20 === 0,
    };
  }
  // a run of consecutive study days, the shape a real streak has
  const reviewLog: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 6, 6) + i * 86_400_000);
    reviewLog[d.toISOString().slice(0, 10)] = 10 + (i % 7);
  }

  return {
    version: 2,
    activeProfileId: "p1",
    savedAt: 1_700_000_500_000,
    profiles: {
      p1: {
        id: "p1",
        name: "Kostiantyn",
        createdAt: 1_600_000_000_000,
        collection: ["hiragana-seion-a", "kanji-n5"],
        paused: [],
        cards,
        customCards: {},
        customDecks: {},
        reviewLog,
        recallTimes: [1200, 2300],
        settings: { reverse: false, autoSound: true, limit: 20, autoFlip: false },
      },
    },
  };
}

/** What the cloud looks like after a wiped device wrote a small store over it. */
function halfOverwritten(bigCards: number, smallCards: number) {
  const big = splitChunks(JSON.stringify(makeStore(bigCards)));
  const small = splitChunks(JSON.stringify(makeStore(smallCards)));
  const parts: Record<number, string> = {};
  big.forEach((p, i) => (parts[i] = p));
  small.forEach((p, i) => (parts[i] = p)); // the head is clobbered in place
  return { parts, declared: small.length, bigChunks: big.length };
}

describe("assembleTail", () => {
  test("takes the run above the declared count", () => {
    const { parts, declared, bigChunks } = halfOverwritten(300, 8);
    const tail = assembleTail(parts, declared);
    expect(tail).not.toBeNull();
    expect(tail!.from).toBe(declared);
    expect(tail!.to).toBe(bigChunks - 1);
  });

  test("stops at the first missing chunk", () => {
    const { parts, declared } = halfOverwritten(300, 8);
    delete parts[declared + 5];
    const tail = assembleTail(parts, declared)!;
    expect(tail.to).toBe(declared + 4);
  });

  test("nothing above the declared count means nothing to salvage", () => {
    const small = splitChunks(JSON.stringify(makeStore(3)));
    const parts: Record<number, string> = {};
    small.forEach((p, i) => (parts[i] = p));
    expect(assembleTail(parts, small.length)).toBeNull();
  });
});

describe("salvageCards", () => {
  test("recovers card state from a tail that is not valid JSON", () => {
    const { parts, declared } = halfOverwritten(300, 8);
    const tail = assembleTail(parts, declared)!;
    expect(() => JSON.parse(tail.text)).toThrow();

    const cards = salvageCards(tail.text);
    // the head is gone, so not all 300 survive, but the bulk must
    expect(Object.keys(cards).length).toBeGreaterThan(250);
    for (const [id, state] of Object.entries(cards)) {
      expect(id).toMatch(/^hiragana:あ\d+:a\d+$/);
      expect(state.totalRepetitions).toBe(4);
      expect(state.history?.length).toBe(2);
    }
  });

  test("keeps kana ids readable", () => {
    const cards = salvageCards(
      '"x":1,"hiragana:ふ:fu":{"interval":3,"timeToReview":99,"totalRepetitions":2,"retired":false}'
    );
    expect(Object.keys(cards)).toEqual(["hiragana:ふ:fu"]);
  });

  test("ignores objects that are not card state", () => {
    const cards = salvageCards(
      '"settings":{"reverse":false,"autoSound":true},"reviewLog":{"2026-08-05":40}'
    );
    expect(cards).toEqual({});
  });

  test("drops the entry the dump was cut in the middle of", () => {
    const cards = salvageCards(
      '"a:1":{"interval":3,"timeToReview":99,"totalRepetitions":2,"retired":false},"b:2":{"interval":3,'
    );
    expect(Object.keys(cards)).toEqual(["a:1"]);
  });
});

describe("salvageReviewLog", () => {
  test("recovers the whole log from the stranded tail", () => {
    // reviewLog is serialised after cards, so a lost head does not take it
    const { parts, declared } = halfOverwritten(300, 8);
    const tail = assembleTail(parts, declared)!;
    const log = salvageReviewLog(tail.text);
    expect(Object.keys(log).length).toBe(30);
    expect(log["2026-07-06"]).toBe(10);
  });

  test("a tail without the log yields nothing rather than guessing", () => {
    expect(salvageReviewLog('"cards":{"a:1":{"interval":3}}')).toEqual({});
  });

  test("ignores an object that is not day → count", () => {
    expect(salvageReviewLog('"reviewLog":{"settings":3}')).toEqual({});
  });

  test("skips a log the dump cut in half and takes the fullest one", () => {
    const text = '"reviewLog":{"2026-08-01":4,"20 ,"reviewLog":{"2026-08-02":7,"2026-08-03":9}';
    expect(salvageReviewLog(text)).toEqual({ "2026-08-02": 7, "2026-08-03": 9 });
  });
});

describe("decksForCards", () => {
  const decks = [
    { id: "hiragana-seion-a", cards: [{ id: "h:あ:a" }, { id: "h:い:i" }] },
    { id: "katakana-seion-a", cards: [{ id: "k:ア:a" }] },
    { id: "kanji-n5", cards: [{ id: "kanji:人" }] },
  ];
  const state = (totalRepetitions: number) => ({
    interval: 1,
    intervalStart: 0,
    timeToReview: 0,
    nRepetitions: 1,
    easinessFactor: 2.5,
    lastGrade: 4 as const,
    totalRepetitions,
    retired: false,
  });

  test("names every deck a studied card came from", () => {
    expect(decksForCards({ "h:い:i": state(3), "kanji:人": state(1) }, decks)).toEqual([
      "hiragana-seion-a",
      "kanji-n5",
    ]);
  });

  test("a card that was never reviewed does not collect its deck", () => {
    expect(decksForCards({ "k:ア:a": state(0) }, decks)).toEqual([]);
  });
});

describe("summarizeSalvage", () => {
  test("counts reviews and the span they cover", () => {
    const { parts, declared } = halfOverwritten(300, 8);
    const cards = salvageCards(assembleTail(parts, declared)!.text);
    const s = summarizeSalvage(cards);
    expect(s.studied).toBe(Object.keys(cards).length);
    expect(s.reviews).toBe(Object.keys(cards).length * 4);
    expect(s.firstReview).toBeGreaterThan(1_500_000_000_000);
    expect(s.lastReview).toBeGreaterThan(s.firstReview!);
  });

  test("carries the recovered review log and its day count", () => {
    const { parts, declared } = halfOverwritten(300, 8);
    const tail = assembleTail(parts, declared)!;
    const s = summarizeSalvage(salvageCards(tail.text), salvageReviewLog(tail.text));
    expect(s.studyDays).toBe(30);
    // 30 consecutive days: exactly what the streak is counted from
    expect(computeStreak(s.reviewLog, Date.UTC(2026, 7, 4)).best).toBe(30);
  });
});

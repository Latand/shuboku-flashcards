import { describe, expect, test } from "bun:test";
import { DAY_MS } from "./scheduler";
import { migrateLegacyProgress, newProfile, normalizeStore, parseImport, newStore } from "./storage";

const NOW = Date.UTC(2026, 7, 1);

describe("v1 Leitner migration", () => {
  test("maps boxes to intervals and collects the owning packs", () => {
    const profile = newProfile("Test", NOW);
    migrateLegacyProgress(
      {
        "hiragana:あ:a": { box: 5, seen: 12, right: 10 },
        "hiragana:い:i": { box: 0, seen: 2, right: 0 },
        "kanji:一": { box: 2, seen: 4, right: 3 },
        "gone:x:y": { box: 3, seen: 1, right: 1 },
      },
      profile,
      NOW
    );

    expect(profile.cards["hiragana:あ:a"].interval).toBe(30);
    expect(profile.cards["hiragana:あ:a"].nRepetitions).toBe(5);
    expect(profile.cards["hiragana:あ:a"].timeToReview).toBe(NOW + 30 * DAY_MS);
    expect(profile.cards["hiragana:あ:a"].totalRepetitions).toBe(12);

    // box 0 stays due immediately
    expect(profile.cards["hiragana:い:i"].timeToReview).toBe(NOW);
    expect(profile.cards["kanji:一"].interval).toBe(3);

    // unknown cards are dropped, known packs join the collection
    expect(profile.cards["gone:x:y"]).toBeUndefined();
    expect(profile.collection.sort()).toEqual(["hiragana-seion-a", "kanji-numbers"]);
  });
});

describe("import validation", () => {
  test("round-trips a store and rejects junk", () => {
    const store = newStore(NOW);
    const back = parseImport(JSON.stringify(store));
    expect(back.activeProfileId).toBe(store.activeProfileId);
    expect(() => parseImport('{"version":1}')).toThrow();
    expect(() => parseImport("not json")).toThrow();
  });

  test("backfills the scheduler retention target in older v2 exports", () => {
    const store = newStore(NOW);
    const profile = store.profiles[store.activeProfileId];
    delete (profile.settings as Partial<typeof profile.settings>).desiredRetention;

    const back = parseImport(JSON.stringify(store));
    expect(back.profiles[back.activeProfileId].settings.desiredRetention).toBe(0.9);
  });

  test("sanitizes imported retention targets", () => {
    const store = newStore(NOW);
    const settings = store.profiles[store.activeProfileId].settings;
    settings.desiredRetention = 9;
    expect(
      parseImport(JSON.stringify(store)).profiles[store.activeProfileId].settings.desiredRetention
    ).toBe(0.97);

    (settings as unknown as { desiredRetention: unknown }).desiredRetention = "high";
    expect(
      parseImport(JSON.stringify(store)).profiles[store.activeProfileId].settings.desiredRetention
    ).toBe(0.9);
  });
});

describe("grade history on stored cards", () => {
  test("reconstructs one entry for cards graded before histories were kept", () => {
    const store = newStore(NOW);
    const profile = store.profiles[store.activeProfileId];
    profile.cards["hiragana:あ:a"] = {
      nRepetitions: 3,
      easinessFactor: 2.5,
      interval: 12,
      intervalStart: NOW - 12 * DAY_MS,
      timeToReview: NOW,
      totalRepetitions: 5,
      lastGrade: 4,
      retired: false,
    };
    const history = normalizeStore(store).profiles[store.activeProfileId].cards["hiragana:あ:a"]
      .history;
    expect(history).toEqual([{ at: NOW - 12 * DAY_MS, grade: 4 }]);
  });

  test("leaves a never-graded card with an empty record rather than a made-up one", () => {
    const store = newStore(NOW);
    const profile = store.profiles[store.activeProfileId];
    profile.cards["hiragana:い:i"] = {
      nRepetitions: 0,
      easinessFactor: 2.5,
      interval: 0,
      intervalStart: NOW,
      timeToReview: NOW,
      totalRepetitions: 0,
      lastGrade: null,
      retired: false,
    };
    expect(
      normalizeStore(store).profiles[store.activeProfileId].cards["hiragana:い:i"].history
    ).toEqual([]);
  });
});

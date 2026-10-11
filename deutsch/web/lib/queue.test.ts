import { describe, expect, test } from "bun:test";
import { DAY_MS, newCardState, review } from "../../../src/lib/scheduler";
import { emptyProgress } from "../../shared/progress";
import type { Pack } from "../data/words";
import { buildQueue, countCards, nextReviewInDays, requeueOnMiss } from "./queue";

const NOW = Date.UTC(2026, 9, 11, 12);

const pack = (id: string, n: number): Pack => ({
  id,
  title: id,
  blurb: "",
  words: Array.from({ length: n }, (_, i) => ({ id: `${id}:w${i}`, de: `w${i}`, uk: `в${i}`, pos: "phrase" as const })),
});

const packs = [pack("pronomen", 3), pack("sein", 2), pack("haben", 4)];

/** A card graded `ago` days ago that came due `due` days from now. */
function graded(ago: number, dueIn: number) {
  const s = review(newCardState(NOW - ago * DAY_MS), 4, NOW - ago * DAY_MS);
  return { ...s, timeToReview: NOW + dueIn * DAY_MS };
}

describe("buildQueue", () => {
  test("uses only the packs that are switched on", () => {
    const q = buildQueue(emptyProgress(), packs, NOW);
    expect(q).toEqual(["pronomen:w0", "pronomen:w1", "pronomen:w2", "sein:w0", "sein:w1"]);
  });

  test("due cards come first, then new cards in pack order", () => {
    const p = emptyProgress();
    p.cards["sein:w1"] = graded(3, -1);
    p.cards["pronomen:w0"] = graded(3, 5); // scheduled later: neither due nor new
    const q = buildQueue(p, packs, NOW);
    expect(q[0]).toBe("sein:w1");
    expect(q.slice(1)).toEqual(["pronomen:w1", "pronomen:w2", "sein:w0"]);
    expect(q).not.toContain("pronomen:w0");
  });

  test("never exceeds the limit and keeps due cards over new ones", () => {
    const p = emptyProgress();
    p.cards["sein:w0"] = graded(3, -1);
    p.cards["sein:w1"] = graded(3, -2);
    const q = buildQueue(p, packs, NOW, 3);
    expect(q).toHaveLength(3);
    expect(q.slice(0, 2).sort()).toEqual(["sein:w0", "sein:w1"]);
  });

  test("shuffles the due cards with the supplied random", () => {
    const p = emptyProgress();
    for (const id of ["pronomen:w0", "pronomen:w1", "pronomen:w2"]) p.cards[id] = graded(3, -1);
    const first = buildQueue(p, packs, NOW, 20, () => 0);
    const second = buildQueue(p, packs, NOW, 20, () => 0.999);
    expect(first.slice(0, 3).sort()).toEqual(second.slice(0, 3).sort());
    expect(first.slice(0, 3)).not.toEqual(second.slice(0, 3));
  });

  test("a card removed from a pack that is off does not come back", () => {
    const p = emptyProgress();
    p.packs.haben = { on: true, at: 5 };
    p.packs.sein = { on: false, at: 5 };
    const q = buildQueue(p, packs, NOW);
    expect(q.some((id) => id.startsWith("sein:"))).toBe(false);
    expect(q.some((id) => id.startsWith("haben:"))).toBe(true);
  });

  test("empty when nothing is on", () => {
    const p = emptyProgress();
    p.packs.pronomen = { on: false, at: 1 };
    p.packs.sein = { on: false, at: 1 };
    expect(buildQueue(p, packs, NOW)).toEqual([]);
  });
});

describe("countCards", () => {
  test("splits due from new", () => {
    const p = emptyProgress();
    p.cards["sein:w0"] = graded(3, -1);
    p.cards["sein:w1"] = graded(3, 4);
    expect(countCards(p, packs, NOW)).toEqual({ due: 1, fresh: 3 });
  });
});

describe("requeueOnMiss", () => {
  test("a miss goes to the end once", () => {
    const retried = new Set<string>();
    let q = ["a", "b", "c"];
    q = requeueOnMiss(q, 0, true, retried);
    expect(q).toEqual(["a", "b", "c", "a"]);
    q = requeueOnMiss(q, 3, true, retried);
    expect(q).toEqual(["a", "b", "c", "a"]);
  });

  test("a hit changes nothing", () => {
    expect(requeueOnMiss(["a", "b"], 0, false, new Set())).toEqual(["a", "b"]);
  });
});

describe("nextReviewInDays", () => {
  test("finds the soonest scheduled card", () => {
    const p = emptyProgress();
    p.cards["sein:w0"] = graded(3, 4);
    p.cards["sein:w1"] = graded(3, 2);
    expect(nextReviewInDays(p, packs, NOW)).toBeCloseTo(2, 5);
  });

  test("null when nothing is scheduled", () => {
    expect(nextReviewInDays(emptyProgress(), packs, NOW)).toBeNull();
  });
});

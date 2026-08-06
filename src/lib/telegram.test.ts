import { describe, expect, test } from "bun:test";
import { CHUNK_SIZE, changedIndexes, chunkDigests, joinChunks, splitChunks } from "./telegram";

describe("cloud storage chunking", () => {
  test("splits and rejoins losslessly", () => {
    const json = JSON.stringify({ a: "х".repeat(50), b: [1, 2, 3] });
    const parts = splitChunks(json, 16);
    expect(parts.every((p) => p.length <= 16)).toBe(true);
    const values = Object.fromEntries(parts.map((p, i) => ["sb_" + i, p]));
    expect(joinChunks(values, parts.length)).toBe(json);
  });

  test("empty input still produces one chunk", () => {
    expect(splitChunks("", 10)).toEqual([""]);
  });

  test("a missing chunk yields null instead of corrupt data", () => {
    const parts = splitChunks("abcdefghij", 4);
    const values = Object.fromEntries(parts.map((p, i) => ["sb_" + i, p]));
    delete values.sb_1;
    expect(joinChunks(values, parts.length)).toBeNull();
  });
});

describe("sending only what changed", () => {
  test("an unchanged store costs no writes at all", () => {
    const parts = splitChunks("a".repeat(CHUNK_SIZE * 3));
    const digests = chunkDigests(parts);
    expect(changedIndexes(digests, digests)).toEqual([]);
  });

  test("editing one card touches only the chunk it lives in", () => {
    const before = splitChunks("a".repeat(CHUNK_SIZE * 3));
    const after = [...before];
    after[1] = "b".repeat(CHUNK_SIZE);
    expect(changedIndexes(chunkDigests(after), chunkDigests(before))).toEqual([1]);
  });

  test("a store that outgrew its chunks writes the new ones", () => {
    const before = splitChunks("a".repeat(CHUNK_SIZE * 2));
    const after = splitChunks("a".repeat(CHUNK_SIZE * 3));
    expect(changedIndexes(chunkDigests(after), chunkDigests(before))).toEqual([2]);
  });

  test("nothing is trusted from an empty record", () => {
    const parts = splitChunks("a".repeat(CHUNK_SIZE * 2));
    expect(changedIndexes(chunkDigests(parts), [])).toEqual([0, 1]);
  });
});

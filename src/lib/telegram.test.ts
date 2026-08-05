import { describe, expect, test } from "bun:test";
import { joinChunks, splitChunks } from "./telegram";

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

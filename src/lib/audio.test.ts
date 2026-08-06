import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { BUILTIN_DECKS } from "../data/packs";
import { AUDIO_READINGS } from "../data/audio-index";
import { audioKey } from "./audio";

describe("clip filenames", () => {
  test("are the reading's codepoints in hex", () => {
    expect(audioKey("あ")).toBe("3042");
    expect(audioKey("ながい")).toBe("306a-304c-3044");
  });

  test("are URL-safe and distinct per reading", () => {
    const keys = [...AUDIO_READINGS].map(audioKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^[0-9a-f]+(-[0-9a-f]+)*$/.test(k))).toBe(true);
  });
});

describe("clip coverage", () => {
  test("the index never promises a clip that is not there", () => {
    // A phantom entry is worse than a missing one: the card would try the file,
    // get a 404 and stay silent instead of falling back to the browser voice.
    const phantom = [...AUDIO_READINGS].filter(
      (reading) => !existsSync(`audio/${audioKey(reading)}.mp3`)
    );
    expect(phantom).toEqual([]);
  });

  test("the readings it does list belong to real cards", () => {
    const known = new Set(BUILTIN_DECKS.flatMap((d) => d.cards.map((c) => c.speak)));
    expect([...AUDIO_READINGS].filter((r) => !known.has(r))).toEqual([]);
  });
});

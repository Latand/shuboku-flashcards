import { describe, expect, test } from "bun:test";
import { pickJapaneseVoice } from "./speech";

const voice = (name: string, lang: string, isDefault = false) =>
  ({ name, lang, default: isDefault, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

describe("choosing a Japanese voice", () => {
  test("returns nothing when the engine has no Japanese at all", () => {
    expect(pickJapaneseVoice([])).toBe(null);
    expect(pickJapaneseVoice([voice("English", "en-GB"), voice("Deutsch", "de-DE")])).toBe(null);
  });

  test("matches the language, not the region", () => {
    const ja = voice("Japanese", "ja");
    expect(pickJapaneseVoice([voice("English", "en-US"), ja])).toBe(ja);
    const jp = voice("Nihongo", "JA-JP");
    expect(pickJapaneseVoice([jp])).toBe(jp);
  });

  test("prefers a known good voice over the engine's own order", () => {
    const kyoko = voice("Kyoko", "ja-JP");
    expect(pickJapaneseVoice([voice("Japanese+Alex", "ja"), kyoko])).toBe(kyoko);
  });

  test("skips the speech-dispatcher variant tail for the base voice", () => {
    // A Linux desktop publishes one base voice and a hundred named variants.
    const variants = ["Japanese+Alex", "Japanese+Alicia", "Japanese+Andrea"].map((n) =>
      voice(n, "ja")
    );
    const base = voice("Japanese", "ja");
    expect(pickJapaneseVoice([...variants, base])).toBe(base);
  });

  test("honours the engine's default before guessing by name", () => {
    const preset = voice("Japanese+Zoe", "ja", true);
    expect(pickJapaneseVoice([voice("Japanese", "ja"), preset])).toBe(preset);
  });
});

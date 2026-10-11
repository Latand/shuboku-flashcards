import { describe, expect, test } from "bun:test";
import { ALL_WORDS, PACKS, type Word } from "./words";

/** Front of a German → Ukrainian card as the learner sees it, hint included. */
const deFront = (x: Word) =>
  `${x.pos === "form" ? x.cloze : `${x.article ?? ""} ${x.de}`} | ${x.deHint ?? ""}`;
/** Front of a Ukrainian → German card as the learner sees it, hint included. */
const ukFront = (x: Word) => `${x.uk} | ${x.ukHint ?? ""}`;

describe("word catalog", () => {
  test("167 cards in 13 packs, worksheet packs first", () => {
    expect(ALL_WORDS).toHaveLength(167);
    expect(PACKS).toHaveLength(13);
    expect(PACKS.map((p) => p.id).slice(0, 2)).toEqual(["pronomen", "sein"]);
    expect(PACKS[0]!.title).toBe("Особові займенники");
    expect(PACKS[1]!.title).toBe("sein – бути");
  });

  test("ids are unique and belong to their pack", () => {
    expect(new Set(ALL_WORDS.map((x) => x.id)).size).toBe(ALL_WORDS.length);
    for (const pack of PACKS) {
      for (const word of pack.words) expect(word.id).toMatch(new RegExp(`^${pack.id}:[a-z0-9-]+$`));
    }
  });

  test("nouns carry an article and a plural decision, nothing else does", () => {
    for (const x of ALL_WORDS) {
      if (x.pos === "noun") {
        expect(["der", "die", "das"]).toContain(x.article!);
        expect(x.plural).not.toBeUndefined();
        if (x.plural !== null) expect(x.plural!.trim()).toBe(x.plural!);
      } else {
        expect(x.article).toBeUndefined();
        expect(x.plural).toBeUndefined();
      }
    }
  });

  test("verb forms carry a cloze that leads into the full form", () => {
    for (const x of ALL_WORDS) {
      if (x.pos !== "form") {
        expect(x.cloze).toBeUndefined();
        continue;
      }
      expect(x.cloze).toMatch(/^\S+ … \([a-z]+\)$/);
      const lead = x.cloze!.split(" … ")[0]!;
      expect(x.de.startsWith(`${lead} `)).toBe(true);
      expect(x.cloze).toContain(`(${x.ukHint})`);
    }
  });

  test("texts are non-empty and trimmed", () => {
    for (const x of ALL_WORDS) {
      for (const text of [x.de, x.uk, x.cloze, x.deHint, x.ukHint, x.note]) {
        if (text === undefined) continue;
        expect(text.length).toBeGreaterThan(0);
        expect(text.trim()).toBe(text);
      }
      expect(x.uk).not.toContain("'"); // Ukrainian uses ’
    }
  });

  test("every card can be told apart from the others in both directions", () => {
    for (const front of [deFront, ukFront]) {
      const keys = ALL_WORDS.map(front);
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
      expect(dupes).toEqual([]);
    }
  });
});

describe("operator worksheet", () => {
  const pack = (id: string) => PACKS.find((p) => p.id === id)!;
  const byId = (id: string) => ALL_WORDS.find((x) => x.id === id)!;

  test("pronouns match the worksheet word for word", () => {
    expect(pack("pronomen").words.map((x) => [x.de, x.uk])).toEqual([
      ["ich", "я"],
      ["du", "ти"],
      ["er", "він"],
      ["sie", "вона"],
      ["es", "воно"],
      ["wir", "ми"],
      ["ihr", "ви (група або клас)"],
      ["sie", "вони"],
      ["Sie", "Ви (ввічлива форма)"],
    ]);
  });

  test("the three sie cards are answerable in both directions", () => {
    expect(byId("pronomen:sie-sg").deHint).toBe("sie ist …");
    expect(byId("pronomen:sie-pl").deHint).toBe("sie sind …");
    expect(byId("pronomen:sie-formal").deHint).toBe("з великої літери: Sie sind …");
    // On the Ukrainian side the three differ already, so no hint is needed there.
    const ukSide = ["pronomen:sie-sg", "pronomen:sie-pl", "pronomen:sie-formal"].map((id) => byId(id).uk);
    expect(new Set(ukSide).size).toBe(3);
    for (const id of ["pronomen:sie-sg", "pronomen:sie-pl", "pronomen:sie-formal"]) expect(byId(id).ukHint).toBeUndefined();
  });

  test("sein is conjugated as on the worksheet, as gap cards", () => {
    expect(pack("sein").words.map((x) => x.de)).toEqual([
      "ich bin",
      "du bist",
      "er/sie/es ist",
      "wir sind",
      "ihr seid",
      "sie/Sie sind",
    ]);
    expect(byId("sein:wir-sind").cloze).toBe("wir … (sein)");
    expect(pack("sein").words.every((x) => x.pos === "form" && x.ukHint === "sein")).toBe(true);
  });
});

describe("German spot checks", () => {
  const noun = (de: string) => ALL_WORDS.find((x) => x.pos === "noun" && x.de === de)!;

  test("articles and plurals of tricky nouns", () => {
    expect([noun("Mädchen").article, noun("Mädchen").plural]).toEqual(["das", "Mädchen"]);
    expect([noun("Apfel").article, noun("Apfel").plural]).toEqual(["der", "Äpfel"]);
    expect([noun("Mutter").article, noun("Mutter").plural]).toEqual(["die", "Mütter"]);
    expect([noun("Buch").article, noun("Buch").plural]).toEqual(["das", "Bücher"]);
    expect([noun("Maus").article, noun("Maus").plural]).toEqual(["die", "Mäuse"]);
    expect([noun("Pferd").article, noun("Pferd").plural]).toEqual(["das", "Pferde"]);
    expect(noun("Wasser").plural).toBeNull();
    expect(noun("Käse").article).toBe("der");
  });

  test("feminine -in nouns are die and have a plural in -innen", () => {
    for (const x of ALL_WORDS) {
      // das Schwein ends in -ein and is not a feminine form
      if (x.pos === "noun" && x.de.endsWith("in") && !x.de.endsWith("ein")) {
        expect(x.article).toBe("die");
        expect(x.plural).toBe(`${x.de}nen`);
      }
    }
  });

  test("verb forms follow the conjugation", () => {
    const forms = (id: string) => PACKS.find((p) => p.id === id)!.words.map((x) => x.de);
    expect(forms("haben")).toEqual(["ich habe", "du hast", "er/sie/es hat", "wir haben", "ihr habt", "sie/Sie haben"]);
  });
});

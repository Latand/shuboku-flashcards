import { describe, expect, test } from "bun:test";
import { cardsLabel, daysLabel, formatInterval, plural, splitClarifier } from "./format";

describe("plural forms", () => {
  test("days", () => {
    expect(daysLabel(1)).toBe("1 день");
    expect(daysLabel(2)).toBe("2 дні");
    expect(daysLabel(5)).toBe("5 днів");
    expect(daysLabel(11)).toBe("11 днів");
    expect(daysLabel(21)).toBe("21 день");
    expect(daysLabel(22)).toBe("22 дні");
  });

  test("cards", () => {
    expect(cardsLabel(0)).toBe("0 карток");
    expect(cardsLabel(1)).toBe("1 картка");
    expect(cardsLabel(2)).toBe("2 картки");
    expect(cardsLabel(5)).toBe("5 карток");
    expect(cardsLabel(14)).toBe("14 карток");
    expect(cardsLabel(21)).toBe("21 картка");
  });

  test("generic helper", () => {
    expect(plural(3, ["а", "б", "в"])).toBe("б");
  });
});

describe("formatInterval", () => {
  test("short and day-scale intervals", () => {
    expect(formatInterval(0)).toBe("скоро");
    expect(formatInterval(0.4)).toBe("скоро");
    expect(formatInterval(1)).toBe("завтра");
    expect(formatInterval(2)).toBe("2 дні");
    expect(formatInterval(5)).toBe("5 днів");
  });

  test("weeks, months, years", () => {
    expect(formatInterval(21)).toBe("3 тижні");
    expect(formatInterval(14)).toBe("2 тижні");
    expect(formatInterval(90)).toBe("3 місяці");
    expect(formatInterval(400)).toBe("1 рік");
    expect(formatInterval(1100)).toBe("3 роки");
  });

  test("garbage input reads as soon", () => {
    expect(formatInterval(NaN)).toBe("скоро");
  });
});

describe("clarifier split", () => {
  test("separates a trailing parenthesis", () => {
    expect(splitClarifier("ви (група або клас)")).toEqual({ main: "ви", clarifier: "(група або клас)" });
    expect(splitClarifier("один (1)")).toEqual({ main: "один", clarifier: "(1)" });
  });

  test("leaves plain text alone", () => {
    expect(splitClarifier("вони є / Ви є")).toEqual({ main: "вони є / Ви є" });
    expect(splitClarifier("Привіт!")).toEqual({ main: "Привіт!" });
  });
});

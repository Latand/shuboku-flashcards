import { describe, expect, test } from "bun:test";
import { wheelDeltaPixels } from "./scroll";

describe("reading a wheel notch", () => {
  test("pixel mode is already in pixels", () => {
    expect(wheelDeltaPixels(120, 0, 800)).toBe(120);
    expect(wheelDeltaPixels(-53, 0, 800)).toBe(-53);
  });

  test("line mode counts lines, page mode counts viewports", () => {
    expect(wheelDeltaPixels(3, 1, 800)).toBe(48);
    expect(wheelDeltaPixels(-1, 2, 800)).toBe(-800);
  });
});

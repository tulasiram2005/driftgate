import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "../src/lib/contrast";

describe("WCAG contrast calculations", () => {
  it("calculates black and white endpoints", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });
  it("is symmetric and gives identical colors ratio one", () => {
    expect(contrastRatio("#abcdef", "#123456")).toBe(contrastRatio("#123456", "#abcdef"));
    expect(contrastRatio("#abcdef", "#abcdef")).toBe(1);
  });
  it.each(["red", "#fff", "#zzzzzz", "abcdef", "#12345678"])(
    "rejects invalid input %s",
    (value) => {
      expect(() => relativeLuminance(value)).toThrow();
    },
  );
  it("meets AA for dark and light secondary text", () => {
    expect(contrastRatio("#a3a8b5", "#202530")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#535965", "#e5e3dc")).toBeGreaterThanOrEqual(4.5);
  });
});

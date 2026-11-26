import { expect, it } from "vitest";
import { reportText } from "../src/report-fonts.js";

it("preserves supported international text and escapes unsupported glyphs and controls", () => {
  expect(reportText("Demo café • Ελληνικά • Кириллица\n123")).toBe(
    "Demo café • Ελληνικά • Кириллица\n123",
  );
  expect(reportText("Demo 🧪\u0000")).toBe("Demo \\u{1f9ea}\\u{0}");
});

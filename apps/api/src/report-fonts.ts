import { fileURLToPath } from "node:url";
import { openSync, type Font } from "fontkit";

export const reportFonts = {
  regular: fileURLToPath(new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url)),
  bold: fileURLToPath(new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url)),
};
const regular = openSync(reportFonts.regular) as Font;
const bold = openSync(reportFonts.bold) as Font;

/** Preserve unsupported glyphs explicitly rather than emitting invisible text. */
export function reportText(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (char === "\n") return char;
      return code >= 32 && regular.hasGlyphForCodePoint(code) && bold.hasGlyphForCodePoint(code)
        ? char
        : `\\u{${code.toString(16)}}`;
    })
    .join("");
}

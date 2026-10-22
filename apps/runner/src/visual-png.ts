import { PNG } from "pngjs";
import { compareVisual, type IgnoreRegion, type Raster } from "./visual.js";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodeScreenshot(bytes: Buffer): Raster {
  // Inspect dimensions before the decoder allocates its pixel buffer.
  if (
    bytes.length < 33 ||
    bytes.length > 16 * 1024 * 1024 ||
    !bytes.subarray(0, 8).equals(signature) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  )
    throw new Error("Invalid or oversized PNG screenshot");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width * height > 8_000_000)
    throw new Error("Screenshot exceeds pixel limit");
  // Only ordinary 8-bit, non-interlaced browser screenshots are supported.
  if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]!) || bytes[28] !== 0)
    throw new Error("Unsupported screenshot PNG format");
  let offset = 33;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("Truncated PNG chunk");
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (length > bytes.length - offset - 12 || type === "IHDR" || type === "acTL")
      throw new Error("Invalid screenshot PNG chunk");
    offset += length + 12;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length) throw new Error("Invalid PNG ending");
      ended = true;
    }
  }
  if (!ended) throw new Error("Missing PNG ending");
  const decoded = PNG.sync.read(bytes, { checkCRC: true });
  return { width: decoded.width, height: decoded.height, rgba: decoded.data };
}

export function compareScreenshots(
  before: Buffer,
  after: Buffer,
  regions: readonly IgnoreRegion[] = [],
) {
  const { diff, ...metrics } = compareVisual(
    decodeScreenshot(before),
    decodeScreenshot(after),
    regions,
  );
  const output = new PNG({
    width: metrics.width,
    height: metrics.height,
  });
  output.data = Buffer.from(diff);
  const diffPng = PNG.sync.write(output);
  return { ...metrics, diffPng };
}

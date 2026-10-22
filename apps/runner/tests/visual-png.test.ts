import { test } from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { compareScreenshots, decodeScreenshot } from "../src/visual-png.js";

function fixture(changed = false) {
  const data = Buffer.alloc(16, 255);
  if (changed) data.fill(0, 0, 3);
  const png = new PNG({ width: 2, height: 2 });
  png.data = data;
  return PNG.sync.write(png);
}
test("PNG comparison produces decodable evidence with exact changed count", () => {
  const before = fixture();
  const original = Buffer.from(before);
  const result = compareScreenshots(before, fixture(true));
  assert.equal(result.changedPixels, 1);
  assert.equal(result.changedRatio, 0.25);
  const decoded = decodeScreenshot(result.diffPng);
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 2);
  assert.equal(decoded.rgba[3], 255);
  assert.deepEqual(before, original);
});
test("PNG comparison applies ignore regions", () => {
  const result = compareScreenshots(fixture(), fixture(true), [
    { x: 0, y: 0, width: 1, height: 1 },
  ]);
  assert.equal(result.changedPixels, 0);
  assert.equal(result.comparedPixels, 3);
});
test("rejects truncated, corrupted and oversized PNG data", () => {
  assert.throws(() => decodeScreenshot(Buffer.from("not a png")));
  assert.throws(() => decodeScreenshot(fixture().subarray(0, 35)));
  assert.throws(() => decodeScreenshot(Buffer.alloc(16 * 1024 * 1024 + 1)));
  const corrupt = fixture();
  corrupt[29] = corrupt[29]! ^ 1;
  assert.throws(() => decodeScreenshot(corrupt));
});
test("rejects excessive dimensions and unsupported format before decoding", () => {
  const huge = fixture();
  huge.writeUInt32BE(8_000_001, 16);
  assert.throws(() => decodeScreenshot(huge), /pixel limit/);
  const unsupported = fixture();
  unsupported[24] = 16;
  assert.throws(() => decodeScreenshot(unsupported), /Unsupported/);
});
test("rejects duplicate headers and trailing data", () => {
  const png = fixture();
  const duplicate = Buffer.concat([png.subarray(0, 33), png.subarray(8)]);
  assert.throws(() => decodeScreenshot(duplicate), /chunk/);
  assert.throws(() => decodeScreenshot(Buffer.concat([png, Buffer.from([0])])), /ending/);
});

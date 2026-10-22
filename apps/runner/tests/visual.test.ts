import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVisual, type Raster } from "../src/visual.js";

const image = (): Raster => ({ width: 2, height: 2, rgba: new Uint8Array(16).fill(255) });
test("identical screenshots have no changed pixels", () => {
  const result = compareVisual(image(), image());
  assert.equal(result.changedPixels, 0);
  assert.equal(result.comparedPixels, 4);
  assert.equal(result.changedRatio, 0);
});
test("counts a changed pixel and produces a diff without mutating evidence", () => {
  const before = image();
  const after = image();
  after.rgba.fill(0, 0, 3);
  const original = new Uint8Array(after.rgba);
  const result = compareVisual(before, after);
  assert.equal(result.changedPixels, 1);
  assert.equal(result.changedRatio, 0.25);
  assert.equal(result.diff[3], 255);
  assert.deepEqual(after.rgba, original);
  assert.deepEqual(before, image());
});
test("overlapping ignore regions are counted once and excluded from the denominator", () => {
  const after = image();
  after.rgba.fill(0, 0, 3);
  after.rgba.fill(0, 12, 15);
  const region = { x: 0, y: 0, width: 1, height: 1 };
  const result = compareVisual(image(), after, [region, region]);
  assert.equal(result.ignoredPixels, 1);
  assert.equal(result.comparedPixels, 3);
  assert.equal(result.changedPixels, 1);
  assert.equal(result.changedRatio, 1 / 3);
  assert.equal(result.diff[3], 0);
});
test("rejects malformed images and mismatched dimensions", () => {
  for (const bad of [
    { ...image(), width: 0 },
    { ...image(), width: 1.5 },
    { ...image(), rgba: new Uint8Array(1) },
    { ...image(), width: 8_000_001 },
  ])
    assert.throws(() => compareVisual(bad, image()));
  assert.throws(() => compareVisual(image(), { ...image(), width: 1, height: 4 }), /dimensions/);
});
test("rejects unbounded, fractional and full-image masks", () => {
  for (const region of [
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 1, y: 0, width: 2, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: 0.5, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 2, height: 2 },
  ])
    assert.throws(() => compareVisual(image(), image(), [region]));
  assert.throws(() =>
    compareVisual(image(), image(), Array(101).fill({ x: 0, y: 0, width: 1, height: 1 })),
  );
});

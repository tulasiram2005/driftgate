import pixelmatch from "pixelmatch";

export type Raster = { width: number; height: number; rgba: Uint8Array };
export type IgnoreRegion = { x: number; y: number; width: number; height: number };

function validate(image: Raster) {
  if (
    !Number.isSafeInteger(image.width) ||
    !Number.isSafeInteger(image.height) ||
    image.width < 1 ||
    image.height < 1 ||
    image.width * image.height > 8_000_000 ||
    !(image.rgba instanceof Uint8Array) ||
    image.rgba.length !== image.width * image.height * 4
  )
    throw new Error("Invalid or oversized RGBA image");
}

export function ignoreMask(width: number, height: number, regions: readonly IgnoreRegion[]) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 8_000_000
  )
    throw new Error("Invalid screenshot dimensions");
  if (regions.length > 100) throw new Error("Too many ignore regions");
  for (const region of regions) {
    if (
      ![region.x, region.y, region.width, region.height].every(Number.isSafeInteger) ||
      region.x < 0 ||
      region.y < 0 ||
      region.width < 1 ||
      region.height < 1 ||
      region.x + region.width > width ||
      region.y + region.height > height
    )
      throw new Error("Ignore region is outside the screenshot");
  }
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);
  for (const region of regions) {
    for (let y = region.y; y < region.y + region.height; y++)
      mask.fill(1, y * width + region.x, y * width + region.x + region.width);
  }
  const ignoredPixels = mask.reduce((sum, value) => sum + value, 0);
  if (ignoredPixels === totalPixels) throw new Error("Ignore regions cover the entire screenshot");
  return { mask, ignoredPixels };
}

/** Compare decoded screenshots without changing the original evidence. */
export function compareVisual(
  before: Raster,
  after: Raster,
  regions: readonly IgnoreRegion[] = [],
) {
  validate(before);
  validate(after);
  if (before.width !== after.width || before.height !== after.height)
    throw new Error("Screenshot dimensions differ; use the matching viewport baseline");
  const totalPixels = before.width * before.height;
  const { mask, ignoredPixels } = ignoreMask(before.width, before.height, regions);
  const left = new Uint8Array(before.rgba);
  const right = new Uint8Array(after.rgba);
  for (let i = 0; i < totalPixels; i++) {
    if (mask[i]) {
      left.fill(255, i * 4, i * 4 + 4);
      right.fill(255, i * 4, i * 4 + 4);
    }
  }
  const diff = new Uint8Array(left.length);
  const changedPixels = pixelmatch(left, right, diff, before.width, before.height, {
    threshold: 0.1,
    includeAA: true,
    diffMask: true,
  });
  const comparedPixels = totalPixels - ignoredPixels;
  return {
    width: before.width,
    height: before.height,
    changedPixels,
    ignoredPixels,
    comparedPixels,
    changedRatio: changedPixels / comparedPixels,
    diff,
  };
}

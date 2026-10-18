export function relativeLuminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex))
    throw new Error(`Expected an opaque six-digit hex color: ${hex}`);
  const channels = [
    [1, 0.2126],
    [3, 0.7152],
    [5, 0.0722],
  ] as const;
  return channels.reduce((sum, [offset, weight]) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * weight;
  }, 0);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

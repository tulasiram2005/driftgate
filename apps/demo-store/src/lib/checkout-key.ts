export function checkoutKey(): string {
  // getRandomValues also works on local HTTP demo hosts where randomUUID is unavailable.
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

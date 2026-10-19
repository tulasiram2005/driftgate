import { createHmac } from "node:crypto";
export function signature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
export async function callback(
  url: string,
  secret: string,
  event: unknown,
  local: boolean,
  send: typeof fetch = fetch,
): Promise<void> {
  const destination = new URL(url);
  if (
    (!local && destination.protocol !== "https:") ||
    !["https:", "http:"].includes(destination.protocol) ||
    destination.username ||
    destination.password ||
    Buffer.byteLength(secret) < 32
  )
    throw new Error("Invalid callback configuration");
  const body = JSON.stringify(event);
  for (let attempt = 0; attempt < 3; attempt++) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    try {
      const response = await send(url, {
        method: "POST",
        body,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          "content-type": "application/json",
          "x-runner-timestamp": timestamp,
          "x-runner-signature": signature(secret, timestamp, body),
        },
      });
      await response.body?.cancel();
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429)
        throw new Error("Permanent callback rejection");
    } catch (error) {
      if (error instanceof Error && error.message === "Permanent callback rejection") throw error;
    }
  }
  throw new Error("Callback delivery failed");
}

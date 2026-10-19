import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Conservative IPv4 public-only policy. IPv6 is denied until separately audited.
export function publicAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a = 0, b = 0, c = 0] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0)
  );
}
export interface NetworkConfig {
  origin: string;
  local: boolean;
  proxy?: string;
}
export async function networkConfig(env: NodeJS.ProcessEnv): Promise<NetworkConfig> {
  const url = new URL(env.RUNNER_TARGET_ORIGIN ?? "");
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("Origin only");
  if (env.RUNNER_MODE === "local-isolated") {
    if (env.RUNNER_LOCAL_ISOLATED !== "1" || url.origin !== "http://127.0.0.1:3201")
      throw new Error("Local isolation required");
    return { origin: url.origin, local: true };
  }
  throw new Error("Production execution disabled pending audited egress infrastructure");
}
export async function validateProductionPolicy(env: NodeJS.ProcessEnv): Promise<NetworkConfig> {
  const url = new URL(env.RUNNER_TARGET_ORIGIN ?? "");
  if (
    env.RUNNER_MODE !== "production" ||
    url.protocol !== "https:" ||
    url.port ||
    url.hostname !== env.RUNNER_ALLOWED_HOST ||
    isIP(url.hostname) ||
    !env.RUNNER_EGRESS_PROXY ||
    env.RUNNER_EGRESS_ENFORCED !== "1"
  )
    throw new Error("Production egress policy required");
  const answers = await lookup(url.hostname, { all: true });
  if (!answers.length || answers.some((a) => !publicAddress(a.address)))
    throw new Error("Nonpublic DNS answer");
  const proxy = new URL(env.RUNNER_EGRESS_PROXY);
  if (!["http:", "https:"].includes(proxy.protocol) || proxy.username || proxy.password)
    throw new Error("Invalid proxy");
  return { origin: url.origin, local: false, proxy: proxy.origin };
}
export function allowedRequest(raw: string, method: string, origin: string): boolean {
  const url = new URL(raw);
  return (
    url.origin === origin &&
    !url.username &&
    !url.password &&
    ["GET", "HEAD"].includes(method) &&
    ["http:", "https:"].includes(url.protocol)
  );
}
export function robotsAllows(text: string): boolean {
  // Accept only an unambiguous wildcard group with no nonempty Disallow.
  let wildcard = false;
  let found = false;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.split("#")[0]?.trim() ?? "";
    if (!clean) continue;
    const match = /^(user-agent|allow|disallow|sitemap):\s*(.*)$/i.exec(clean);
    if (!match) return false;
    const key = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (key === "sitemap") continue;
    if (key === "user-agent") {
      wildcard = value === "*";
      found ||= wildcard;
    } else if (wildcard && key === "disallow" && value) return false;
  }
  return found;
}

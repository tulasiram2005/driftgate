import type { Page } from "@playwright/test";
import { QualityCheckError } from "./quality.js";
import { allowedRequest } from "./network.js";

export function linkTargets(hrefs: string[], origin: string, environment: string): string[] {
  if (hrefs.length > 100) throw new QualityCheckError("Link check exceeds 100 anchors");
  const targets = new Set<string>();
  for (const href of hrefs) {
    if (!href.trim() || href.trim().startsWith("#")) continue;
    let url: URL;
    try {
      url = new URL(href, `${origin}/${environment}`);
    } catch {
      throw new QualityCheckError("Catalogue contains an invalid link");
    }
    if (!["http:", "https:"].includes(url.protocol)) continue;
    if (url.username || url.password) throw new QualityCheckError("Link contains credentials");
    if (url.origin !== origin) continue;
    if (url.pathname !== `/${environment}` && !url.pathname.startsWith(`/${environment}/`))
      continue;
    url.hash = "";
    targets.add(url.href);
    if (targets.size > 20) throw new QualityCheckError("Link check exceeds 20 unique targets");
  }
  return [...targets];
}

export async function checkLinks(page: Page, origin: string, environment: string): Promise<void> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((nodes) => nodes.slice(0, 101).map((node) => (node as HTMLAnchorElement).href));
  const targets = linkTargets(hrefs, origin, environment);
  if (!targets.length) throw new QualityCheckError("No in-scope links found");
  const probe = await page.context().newPage();
  let failures = 0;
  try {
    // Keep navigation behind the context network policy. Do not load destination assets.
    await probe.route("**/*", async (route) => {
      const request = route.request();
      if (
        request.resourceType() !== "document" ||
        request.redirectedFrom() ||
        !allowedRequest(request.url(), request.method(), origin)
      ) {
        await route.abort();
        return;
      }
      await route.fallback();
    });
    for (const target of targets) {
      try {
        // Finish document parsing before navigating again or closing the probe tab.
        // Chromium can stall closing a tab whose final navigation only committed.
        const response = await probe.goto(target, { waitUntil: "domcontentloaded", timeout: 3000 });
        if (!response || response.status() < 200 || response.status() >= 300) {
          failures++;
          continue;
        }
        // Threadline product pages are client-rendered HTTP 200 shells, even for missing slugs.
        const pathname = new URL(target).pathname;
        const prefix = `/${environment}/products/`;
        if (pathname.startsWith(prefix)) {
          const slug = pathname.slice(prefix.length);
          if (!/^[a-z0-9-]{1,100}$/.test(slug)) {
            failures++;
            continue;
          }
          const product = await probe.goto(`${origin}/api/${environment}/products/${slug}`, {
            waitUntil: "domcontentloaded",
            timeout: 3000,
          });
          if (!product || product.status() !== 200) failures++;
        }
      } catch {
        failures++;
      }
    }
  } finally {
    await probe.close();
  }
  if (failures)
    throw new QualityCheckError(
      `Broken or unavailable links: ${failures} of ${targets.length} (includes timeouts and denied redirects)`,
    );
}

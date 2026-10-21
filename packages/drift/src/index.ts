export type Environment = "staging" | "uat" | "preprod" | "prod";
type Currency = "INR" | "USD" | "EUR" | "GBP";
/** Numbers are integer cents; formatted strings are major units in the snapshot locale. */
type Price = number | string;
export interface ProductSnapshot {
  readonly id: string;
  readonly priceCents: Price;
  readonly compareAtCents: Price | null;
  readonly currency: string;
  readonly sizes: readonly { readonly label: string; readonly stock: number }[];
  readonly discountPercent: number | null;
  readonly badge: string | null;
  readonly image: {
    readonly status: number | null;
    readonly width: number | null;
    readonly height: number | null;
  };
  readonly title: string | null;
  readonly canonical: string | null;
  readonly jsonLd: {
    readonly "@context"?: string;
    readonly "@type": "Product";
    readonly name: string;
    readonly description?: string;
    readonly image?: string;
    readonly sku: string;
    readonly offers: {
      readonly "@type": "Offer";
      readonly price: string;
      readonly priceCurrency: string;
      readonly availability: string;
      readonly url: string;
    };
  } | null;
}
export interface EnvironmentSnapshot {
  readonly environment: Environment;
  readonly origin: string;
  readonly locale: "en-US" | "en-IN" | "de-DE";
  readonly productCount: number;
  readonly products: readonly ProductSnapshot[];
}
export type DriftField =
  | "product"
  | "productCount"
  | "price"
  | "compareAt"
  | "currency"
  | "size"
  | "stock"
  | "discountPercent"
  | "badge"
  | "image.status"
  | "image.width"
  | "image.height"
  | "title"
  | "canonical"
  | "jsonLd";
export interface ExpectedDifference {
  readonly field: DriftField;
  /** null matches only catalogue-level findings. No wildcards. */
  readonly productId: string | null;
  readonly environments: readonly [Environment, Environment];
}
export interface DriftFinding {
  readonly field: DriftField;
  readonly productId: string | null;
  readonly size: string | null;
  readonly environments: readonly [Environment, Environment];
  readonly severity: "S1" | "S2" | "S3";
  readonly before: string | number | boolean | null;
  readonly after: string | number | boolean | null;
  readonly expected: boolean;
}

const text = (value: string) => {
  if (value.length > 4096) throw new Error("Text limit exceeded");
  return value.trim().replace(/\s+/g, " ");
};
function currency(value: string): Currency {
  const code = text(value).toUpperCase();
  if (!["INR", "USD", "EUR", "GBP"].includes(code)) throw new Error("Unsupported currency");
  return code as Currency;
}
function integer(value: number, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max)
    throw new Error("Invalid nonnegative integer");
  return value;
}
function money(value: Price, code: Currency, locale: EnvironmentSnapshot["locale"]): number {
  if (typeof value === "number") return integer(value);
  const symbol = { INR: "₹", USD: "$", EUR: "€", GBP: "£" }[code];
  let raw = text(value);
  if (raw.startsWith(code)) raw = raw.slice(3).trim();
  else if (raw.endsWith(code)) raw = raw.slice(0, -3).trim();
  else if (raw.startsWith(symbol)) raw = raw.slice(symbol.length).trim();
  else if (raw.endsWith(symbol)) raw = raw.slice(0, -symbol.length).trim();
  const pattern =
    locale === "de-DE"
      ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/
      : locale === "en-IN"
        ? /^(?:\d+|\d{1,3},\d{3}|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/
        : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!pattern.test(raw)) throw new Error("Invalid formatted price");
  raw = locale === "de-DE" ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  const [whole = "", fraction = ""] = raw.split(".");
  return integer(Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
}
function route(value: string | null, snapshot: EnvironmentSnapshot): string | null {
  if (value === null) return null;
  const url = new URL(text(value), snapshot.origin);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid page URL");
  const origin = new URL(snapshot.origin).origin;
  const prefix = `/${snapshot.environment}`;
  const path =
    url.origin !== origin
      ? url.pathname
      : url.pathname === prefix
        ? "/"
        : url.pathname.startsWith(`${prefix}/`)
          ? url.pathname.slice(prefix.length)
          : url.pathname;
  return `${url.origin === origin ? "" : url.origin}${path}${url.search}${url.hash}`;
}
function normalize(snapshot: EnvironmentSnapshot) {
  if (
    !["staging", "uat", "preprod", "prod"].includes(snapshot.environment) ||
    !["en-US", "en-IN", "de-DE"].includes(snapshot.locale)
  )
    throw new Error("Invalid snapshot");
  const origin = new URL(text(snapshot.origin));
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Invalid origin");
  integer(snapshot.productCount);
  if (snapshot.products.length > 1000) throw new Error("Product limit exceeded");
  const products = new Map<string, ReturnType<typeof normalizeProduct>>();
  for (const product of snapshot.products) {
    if (products.has(product.id)) throw new Error("Duplicate product");
    products.set(product.id, normalizeProduct(product, snapshot));
  }
  return products;
}
function normalizeProduct(product: ProductSnapshot, snapshot: EnvironmentSnapshot) {
  if (!product.id.trim() || product.id.length > 200 || product.sizes.length > 100)
    throw new Error("Invalid product identity or size limit");
  const code = currency(product.currency);
  const sizes = new Map<string, number>();
  for (const size of product.sizes) {
    const label = text(size.label).toUpperCase();
    if (!label || label.length > 100 || sizes.has(label))
      throw new Error("Invalid or duplicate size");
    sizes.set(label, integer(size.stock));
  }
  if (
    product.discountPercent !== null &&
    (!Number.isFinite(product.discountPercent) ||
      product.discountPercent < 0 ||
      product.discountPercent > 100)
  )
    throw new Error("Invalid discount");
  const schema = product.jsonLd;
  if (product.image.status !== null && product.image.status < 100)
    throw new Error("Invalid HTTP status");
  if (schema && (schema["@type"] !== "Product" || schema.offers["@type"] !== "Offer"))
    throw new Error("Invalid Product JSON-LD");
  return {
    price: money(product.priceCents, code, snapshot.locale),
    compareAt:
      product.compareAtCents === null ? null : money(product.compareAtCents, code, snapshot.locale),
    currency: code,
    discountPercent: product.discountPercent,
    badge: product.badge === null ? null : text(product.badge),
    "image.status": product.image.status === null ? null : integer(product.image.status, 599),
    "image.width": product.image.width === null ? null : integer(product.image.width),
    "image.height": product.image.height === null ? null : integer(product.image.height),
    title: product.title === null ? null : text(product.title),
    canonical: route(product.canonical, snapshot),
    jsonLd:
      schema === null
        ? null
        : JSON.stringify({
            context: schema["@context"] === undefined ? null : text(schema["@context"]),
            name: text(schema.name),
            description: schema.description === undefined ? null : text(schema.description),
            image: schema.image === undefined ? null : route(schema.image, snapshot),
            sku: text(schema.sku),
            price: money(schema.offers.price, currency(schema.offers.priceCurrency), "en-US"),
            currency: currency(schema.offers.priceCurrency),
            availability: text(schema.offers.availability),
            url: route(schema.offers.url, snapshot),
          }),
    sizes,
  };
}

/** Pure ordered-pair comparison. Expected rules match either order of the exact pair. */
export function compareEnvironments(
  before: EnvironmentSnapshot,
  after: EnvironmentSnapshot,
  expected: readonly ExpectedDifference[] = [],
): DriftFinding[] {
  if (before.environment === after.environment) throw new Error("Distinct environments required");
  if (expected.length > 1000) throw new Error("Expected-difference limit exceeded");
  const left = normalize(before);
  const right = normalize(after);
  const findings: DriftFinding[] = [];
  const add = (
    field: DriftField,
    productId: string | null,
    a: DriftFinding["before"],
    b: DriftFinding["after"],
    size: string | null = null,
  ) => {
    if (a === b) return;
    findings.push({
      field,
      productId,
      size,
      before: a,
      after: b,
      environments: [before.environment, after.environment],
      severity: ["price", "compareAt", "currency", "discountPercent", "badge"].includes(field)
        ? "S1"
        : ["product", "size", "stock"].includes(field)
          ? "S2"
          : "S3",
      expected: expected.some(
        (rule) =>
          rule.field === field &&
          rule.productId === productId &&
          ((rule.environments[0] === before.environment &&
            rule.environments[1] === after.environment) ||
            (rule.environments[1] === before.environment &&
              rule.environments[0] === after.environment)),
      ),
    });
  };
  add("productCount", null, before.productCount, after.productCount);
  for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const a = left.get(id);
    const b = right.get(id);
    if (!a || !b) {
      add("product", id, !!a, !!b);
      continue;
    }
    for (const field of [
      "price",
      "compareAt",
      "currency",
      "discountPercent",
      "badge",
      "image.status",
      "image.width",
      "image.height",
      "title",
      "canonical",
      "jsonLd",
    ] as const)
      add(field, id, a[field], b[field]);
    for (const label of [...new Set([...a.sizes.keys(), ...b.sizes.keys()])].sort()) {
      if (!a.sizes.has(label) || !b.sizes.has(label))
        add("size", id, a.sizes.has(label), b.sizes.has(label), label);
      else add("stock", id, a.sizes.get(label)!, b.sizes.get(label)!, label);
    }
  }
  return findings;
}

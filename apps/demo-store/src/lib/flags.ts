import { StoreError } from "./errors";

export const environments = ["staging", "uat", "preprod", "prod"] as const;
export type Environment = (typeof environments)[number];
export const bugFlags = [
  "missingAlt",
  "mobileImageBroken",
  "webkitCheckoutHidden",
  "wrongCanonical",
  "missingJsonLd",
  "staleBadge",
  "missingProduct",
  "priceMismatch",
  "couponStacking",
  "stockMismatch",
  "taxRounding",
  "emptyCart500",
  "brokenImage",
  "brokenLink",
  "wrongProductTitle",
] as const;
export type BugFlag = (typeof bugFlags)[number];
export const seedFlags: Record<Environment, readonly BugFlag[]> = {
  staging: [],
  uat: ["missingAlt", "mobileImageBroken", "priceMismatch", "couponStacking", "stockMismatch"],
  preprod: [
    "webkitCheckoutHidden",
    "wrongCanonical",
    "missingJsonLd",
    "taxRounding",
    "emptyCart500",
  ],
  prod: ["staleBadge", "missingProduct", "brokenImage", "brokenLink", "wrongProductTitle"],
};
export function parseEnvironment(value: string): Environment {
  if (!environments.includes(value as Environment))
    throw new StoreError(404, "ENVIRONMENT_NOT_FOUND", "Unknown store environment.");
  return value as Environment;
}
export function getFlags(
  environment: Environment,
  override = process.env.THREADLINE_BUG_FLAGS,
): BugFlag[] {
  if (override === undefined || override.trim() === "") return [...seedFlags[environment]];
  if (override.trim() === "none") return [];
  const names = override.split(",").map((name) => name.trim());
  if (names.some((name) => !bugFlags.includes(name as BugFlag)))
    throw new StoreError(
      503,
      "INVALID_BUG_FLAGS",
      "THREADLINE_BUG_FLAGS contains an unknown or empty flag.",
    );
  return [...new Set(names)] as BugFlag[];
}

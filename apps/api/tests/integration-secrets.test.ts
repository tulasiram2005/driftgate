import { describe, expect, it } from "vitest";
import { decryptIntegrationSecret, encryptIntegrationSecret } from "../src/integration-secrets.js";

const key = "ab".repeat(32);
const encrypt = (secret = "test-only-jira-token") =>
  encryptIntegrationSecret(secret, key, "project-one", "jira");
const decrypt = (value: string) => decryptIntegrationSecret(value, key, "project-one", "jira");

describe("integration credential encryption", () => {
  it("round trips without storing plaintext and uses a fresh nonce", () => {
    const first = encrypt();
    expect(decrypt(first)).toBe("test-only-jira-token");
    expect(first).not.toContain("test-only-jira-token");
    expect(encrypt()).not.toBe(first);
  });
  it.each(["project-two", "project-one\u0000jira"])("rejects swapped project %s", (project) => {
    expect(() => decryptIntegrationSecret(encrypt(), key, project, "jira")).toThrow(
      "Unable to decrypt integration secret",
    );
  });
  it("rejects swapped provider and wrong encryption keys", () => {
    expect(() => decryptIntegrationSecret(encrypt(), key, "project-one", "github")).toThrow();
    expect(() =>
      decryptIntegrationSecret(encrypt(), "cd".repeat(32), "project-one", "jira"),
    ).toThrow();
  });
  it.each(["iv", "tag", "ciphertext"])("rejects tampered %s", (field) => {
    const data = JSON.parse(encrypt()) as Record<string, string>;
    const original = data[field]!;
    data[field] = (original[0] === "0" ? "1" : "0") + original.slice(1);
    expect(() => decrypt(JSON.stringify(data))).toThrow("Unable to decrypt integration secret");
  });
  it.each(["not-json", "{}", '{"version":2}', "x".repeat(33001)])(
    "rejects malformed envelopes",
    (value) => {
      expect(() => decrypt(value)).toThrow("Unable to decrypt integration secret");
    },
  );
  it("rejects invalid keys, empty context and invalid secret lengths", () => {
    expect(() => encryptIntegrationSecret("token", "short", "p", "jira")).toThrow();
    expect(() => encryptIntegrationSecret("token", key, "", "jira")).toThrow();
    expect(() => encrypt("")).toThrow();
    expect(() => encrypt("x".repeat(16385))).toThrow();
    expect(decrypt(encrypt("x".repeat(16384)))).toHaveLength(16384);
  });
});

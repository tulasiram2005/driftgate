import { describe, expect, it, vi } from "vitest";
import { createJiraClient, jiraSiteOrigin } from "../src/jira-client.js";

const config = {
  site: "https://example.atlassian.net",
  email: "demo@example.com",
  token: "test-only",
  projectKey: "KAN",
  issueTypeId: "10011",
};
const input = { summary: "Demo defect", description: "Expected: visible\nActual: missing" };
const response = (data: unknown, code = 200) =>
  new Response(JSON.stringify(data), { status: code });

describe("Jira client", () => {
  it.each([
    "http://example.atlassian.net",
    "https://atlassian.net.evil.com",
    "https://localhost",
    "https://example.atlassian.net@evil.com",
    "https://example.atlassian.net:444",
    "https://example.atlassian.net/path",
    "https://example.atlassian.net?token=x",
  ])("rejects unsafe origin %s", (site) => {
    expect(() => jiraSiteOrigin(site)).toThrow();
  });
  it("normalizes an allowed origin", () => {
    expect(jiraSiteOrigin(`${config.site}/`)).toBe(config.site);
  });
  it("creates plain text ADF and returns a locally constructed issue URL", async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ id: "123", key: "KAN-1", self: "https://evil.com" }, 201));
    const result = await createJiraClient(config, send).createIssue(input);
    expect(result).toEqual({ id: "123", key: "KAN-1", url: `${config.site}/browse/KAN-1` });
    const [url, options] = send.mock.calls[0]!;
    expect(url).toBe(`${config.site}/rest/api/3/issue`);
    expect(options?.redirect).toBe("error");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(options?.body as string).fields.description.content[0].content[0]).toEqual({
      type: "text",
      text: input.description,
    });
  });
  it.each([
    [401, "AUTH"],
    [403, "AUTH"],
    [429, "RATE_LIMIT"],
    [500, "UNAVAILABLE"],
    [400, "REJECTED"],
  ])("redacts HTTP %s and does not retry", async (http, code) => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ secret: "do-not-leak" }, Number(http)));
    await expect(createJiraClient(config, send).createIssue(input)).rejects.toThrow(
      `Jira request failed: ${code}`,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("redacts network failures without retrying creation", async () => {
    const send = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret header"));
    await expect(createJiraClient(config, send).createIssue(input)).rejects.toThrow(
      "Jira request failed: UNAVAILABLE",
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("reads remote status without inferring QA sign-off", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        id: "123",
        key: "KAN-1",
        fields: {
          status: { id: "3", name: "In Review", statusCategory: { key: "indeterminate" } },
        },
      }),
    );
    expect(await createJiraClient(config, send).getIssueStatus("KAN-1")).toEqual({
      key: "KAN-1",
      id: "3",
      name: "In Review",
      statusCategory: { key: "indeterminate" },
    });
  });
  it("rejects unsafe and other-project keys before sending", async () => {
    const send = vi.fn<typeof fetch>();
    const client = createJiraClient(config, send);
    await expect(client.getIssueStatus("../myself")).rejects.toThrow();
    await expect(client.getIssueStatus("OTHER-1")).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it.each([{ id: "123", key: "OTHER-1" }, { id: "123", key: "KAN-1/evil" }, {}])(
    "rejects malformed issue results",
    async (data) => {
      const send = vi.fn<typeof fetch>().mockResolvedValue(response(data));
      await expect(createJiraClient(config, send).createIssue(input)).rejects.toThrow(
        "INVALID_RESPONSE",
      );
    },
  );
  it("bounds response size", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(response({ text: "x".repeat(65536) }));
    await expect(createJiraClient(config, send).createIssue(input)).rejects.toThrow(
      "INVALID_RESPONSE",
    );
  });
  it("validates input before sending", async () => {
    const send = vi.fn<typeof fetch>();
    await expect(
      createJiraClient(config, send).createIssue({ ...input, summary: " " }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

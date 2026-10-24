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
  it("checks authenticated identity, configured issue type and project permissions using GET only", async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ accountId: "demo", active: true }))
      .mockResolvedValueOnce(
        response({ key: "KAN", issueTypes: [{ id: "10011", subtask: false }] }),
      )
      .mockResolvedValueOnce(
        response({
          permissions: {
            BROWSE_PROJECTS: { havePermission: true },
            CREATE_ISSUES: { havePermission: true },
          },
        }),
      );
    expect(await createJiraClient(config, send).verifyAccess()).toEqual({
      projectKey: "KAN",
      issueTypeId: "10011",
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.every(([, options]) => options?.method === "GET" && !options.body)).toBe(
      true,
    );
    expect(send.mock.calls[2]![0]).toContain(
      "projectKey=KAN&permissions=BROWSE_PROJECTS%2CCREATE_ISSUES",
    );
  });
  it.each([
    { key: "OTHER", issueTypes: [] },
    { key: "KAN", issueTypes: [] },
    { key: "KAN", issueTypes: [{ id: "10011", subtask: true }] },
  ])("rejects wrong projects, missing types and subtask types", async (project) => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ accountId: "demo", active: true }))
      .mockResolvedValueOnce(response(project));
    await expect(createJiraClient(config, send).verifyAccess()).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("rejects inactive identities before checking the project", async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ accountId: "demo", active: false }));
    await expect(createJiraClient(config, send).verifyAccess()).rejects.toThrow("AUTH");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each([false, "true", undefined])(
    "does not accept missing, denied or malformed permissions",
    async (allowed) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(response({ accountId: "demo", active: true }))
        .mockResolvedValueOnce(
          response({ key: "KAN", issueTypes: [{ id: "10011", subtask: false }] }),
        )
        .mockResolvedValueOnce(
          response({
            permissions: {
              BROWSE_PROJECTS: { havePermission: true },
              CREATE_ISSUES: { havePermission: allowed },
            },
          }),
        );
      await expect(createJiraClient(config, send).verifyAccess()).rejects.toThrow();
    },
  );
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
    await expect(client.verifyExport("../myself", "demo-id")).rejects.toThrow();
    await expect(client.verifyExport("OTHER-1", "demo-id")).rejects.toThrow();
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
  it.each(["demo-id", "other-id", "demo-id-extra"])(
    "checks exact reconciliation marker %s",
    async (marker) => {
      const send = vi.fn<typeof fetch>().mockResolvedValue(
        response({
          id: "123",
          key: "KAN-1",
          fields: {
            status: { id: "1", name: "To Do", statusCategory: { key: "new" } },
            description: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: `DriftGate defect: ${marker}\nSeverity: S4`,
                    },
                  ],
                },
              ],
            },
          },
        }),
      );
      const result = createJiraClient(config, send).verifyExport("KAN-1", "demo-id");
      if (marker === "demo-id")
        await expect(result).resolves.toMatchObject({ key: "KAN-1", name: "To Do" });
      else await expect(result).rejects.toThrow("INVALID_RESPONSE");
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![1]?.method).toBe("GET");
    },
  );
  it("validates input before sending", async () => {
    const send = vi.fn<typeof fetch>();
    await expect(
      createJiraClient(config, send).createIssue({ ...input, summary: " " }),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const user = { id: "user-1", name: "QA Engineer", email: "qa@example.test" };
const session = { accessToken: "access-original", user };
const ok = (data: unknown) => Response.json({ data });
const unauthorized = () =>
  Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in" } }, { status: 401 });

async function setup() {
  const client = await import("../src/lib/qa-api");
  const fetchMock = vi.mocked(fetch);
  return { ...client, fetchMock };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("window", new EventTarget());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("memory-only authentication", () => {
  it("authenticates event streams and sends the resume cursor in a header", async () => {
    const { acceptSession, runEvents, fetchMock } = await setup();
    acceptSession(session);
    fetchMock.mockResolvedValueOnce(
      new Response("id: 8\ndata: updated\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const receive = vi.fn();
    const signal = new AbortController().signal;
    await runEvents("/projects/p/runs/r/events", signal, "7", receive);
    expect(receive).toHaveBeenCalledWith({ id: "8", event: "message", data: "updated" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/p/runs/r/events",
      expect.objectContaining({
        signal,
        headers: {
          Accept: "text/event-stream",
          "Last-Event-ID": "7",
          Authorization: "Bearer access-original",
        },
      }),
    );
  });
  it("reports malformed and denied event streams", async () => {
    const { runEvents, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(ok([]));
    await expect(runEvents("/events", new AbortController().signal, "", vi.fn())).rejects.toThrow(
      "temporarily unavailable",
    );
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(runEvents("/events", new AbortController().signal, "", vi.fn())).rejects.toThrow(
      "temporarily unavailable",
    );
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "DENIED", message: "Denied" } }, { status: 403 }),
    );
    await expect(runEvents("/events", new AbortController().signal, "", vi.fn())).rejects.toThrow(
      "Denied",
    );
  });
  it.each(["login", "register"] as const)(
    "accepts a %s session and sends credentials only to the relative API",
    async (path) => {
      const { authenticate, api, fetchMock } = await setup();
      fetchMock.mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok([{ id: "project-1" }]));
      const body = {
        email: user.email,
        password: "Unit-test-password!",
        ...(path === "register" ? { name: user.name } : {}),
      };
      expect(await authenticate(path, body)).toEqual(user);
      expect(fetchMock).toHaveBeenNthCalledWith(1, `/api/v1/auth/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(await api("/projects")).toEqual([{ id: "project-1" }]);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/v1/projects",
        expect.objectContaining({
          credentials: "include",
          cache: "no-store",
          headers: { Authorization: "Bearer access-original" },
        }),
      );
    },
  );

  it("forgets the access token after logout", async () => {
    const { acceptSession, forgetSession, api, fetchMock } = await setup();
    expect(acceptSession(session)).toEqual(user);
    fetchMock.mockResolvedValueOnce(ok({ loggedOut: true })).mockResolvedValueOnce(ok([]));
    await api("/auth/logout", "POST");
    forgetSession();
    await api("/projects");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("restores a cookie session without putting a token in the refresh body", async () => {
    const { refreshSession, api, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(ok(session)).mockResolvedValueOnce(ok([]));
    expect(await refreshSession()).toEqual(user);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    await api("/projects");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects",
      expect.objectContaining({ headers: { Authorization: "Bearer access-original" } }),
    );
  });

  it("treats an initial refresh 401 as a signed-out session and removes any stale token", async () => {
    const { acceptSession, refreshSession, api, fetchMock } = await setup();
    acceptSession(session);
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok([]));
    expect(await refreshSession()).toBeNull();
    await api("/projects");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects",
      expect.objectContaining({ headers: {} }),
    );
  });

  it("deduplicates simultaneous cookie refreshes and permits a later refresh", async () => {
    const { refreshSession, fetchMock } = await setup();
    let resolve!: (response: Response) => void;
    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce(ok(session));
    const first = refreshSession();
    const second = refreshSession();
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(ok(session));
    expect(await Promise.all([first, second])).toEqual([user, user]);
    expect(await refreshSession()).toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("releases a failed refresh so a network retry can succeed", async () => {
    const { refreshSession, fetchMock } = await setup();
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(ok(session));
    await expect(refreshSession()).rejects.toThrow("Network unavailable");
    expect(await refreshSession()).toEqual(user);
  });

  it("does not disguise a refresh server failure as a logged-out state", async () => {
    const { refreshSession, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { code: "SERVICE_UNAVAILABLE", message: "Try later" } },
        { status: 503 },
      ),
    );
    await expect(refreshSession()).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Try later",
    });
  });
});

describe("authorized requests and refresh races", () => {
  it("refreshes and retries a request once with a replacement token", async () => {
    const { acceptSession, api, fetchMock } = await setup();
    acceptSession(session);
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ ...session, accessToken: "access-new" }))
      .mockResolvedValueOnce(ok({ id: "new-case" }));
    const body = { title: "Checkout" };
    expect(await api("/projects/p/cases", "POST", body)).toEqual({ id: "new-case" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/v1/projects/p/cases",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", Authorization: "Bearer access-new" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("shares one refresh between concurrent rejected API requests", async () => {
    const { acceptSession, api, fetchMock } = await setup();
    acceptSession(session);
    let resolveRefresh!: (response: Response) => void;
    const refresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    fetchMock.mockImplementation(async (path, init) => {
      if (path === "/api/v1/auth/refresh") return refresh;
      const token = (init?.headers as Record<string, string>)?.Authorization;
      return token === "Bearer access-original" ? unauthorized() : ok(path);
    });
    const first = api("/projects/p/cases");
    const second = api("/projects/p/suites");
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/auth/refresh")).toHaveLength(
        1,
      ),
    );
    resolveRefresh(ok({ ...session, accessToken: "access-rotated" }));
    expect(await Promise.all([first, second])).toEqual([
      "/api/v1/projects/p/cases",
      "/api/v1/projects/p/suites",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("uses a sibling's newer token when a delayed 401 arrives after refresh", async () => {
    const { acceptSession, api, fetchMock } = await setup();
    acceptSession(session);
    let resolveLate!: (response: Response) => void;
    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveLate = resolve;
        }),
      )
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ ...session, accessToken: "newer-token" }))
      .mockImplementation(async () => ok([]));
    const late = api("/late");
    await api("/first");
    resolveLate(unauthorized());
    expect(await late).toEqual([]);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/v1/auth/refresh")).toHaveLength(
      1,
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/late",
      expect.objectContaining({ headers: { Authorization: "Bearer newer-token" } }),
    );
  });

  it("announces an expired cookie session and does not retry an unauthenticated write", async () => {
    const { acceptSession, api, fetchMock } = await setup();
    acceptSession(session);
    const expired = vi.fn();
    window.addEventListener("driftgate:unauthorized", expired);
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await expect(api("/projects", "POST", { name: "Project" })).rejects.toMatchObject({
      status: 401,
      code: "SESSION_EXPIRED",
    });
    expect(expired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after a retry 401 and clears the invalid token", async () => {
    const { acceptSession, api, fetchMock } = await setup();
    acceptSession(session);
    const expired = vi.fn();
    window.addEventListener("driftgate:unauthorized", expired);
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({ ...session, accessToken: "still-invalid" }))
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok([]));
    await expect(api("/projects")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    await api("/projects");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/v1/projects",
      expect.objectContaining({ headers: {} }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("supports a successful DELETE with no content", async () => {
    const { api, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api("/projects/p/cases/c", "DELETE")).toBeUndefined();
  });

  it("surfaces permission errors without refreshing the session", async () => {
    const { api, fetchMock, ApiError } = await setup();
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "FORBIDDEN", message: "Read-only role" } }, { status: 403 }),
    );
    await expect(api("/projects/p/cases", "POST", {})).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([new Response("Proxy unavailable", { status: 502 }), Response.json({}, { status: 500 })])(
    "gives a useful fallback for missing error details",
    async (response) => {
      const { api, fetchMock } = await setup();
      fetchMock.mockResolvedValueOnce(response);
      await expect(api("/projects")).rejects.toMatchObject({
        code: "REQUEST_FAILED",
        message: `Request failed (${response.status}). Please try again.`,
      });
    },
  );

  it("preserves network failures for the UI retry state", async () => {
    const { api, fetchMock } = await setup();
    fetchMock.mockRejectedValueOnce(new TypeError("Offline"));
    await expect(api("/projects")).rejects.toThrow("Offline");
  });
});

describe("cursor pagination", () => {
  it("keeps single-page errors available to retry controls", async () => {
    const { page, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: { code: "UNAVAILABLE", message: "Try again" } }, { status: 503 }),
    );
    await expect(page("/projects/p/snapshots")).rejects.toMatchObject({
      status: 503,
      message: "Try again",
    });
  });
  it("loads one bounded page and preserves its continuation cursor", async () => {
    const { page, acceptSession, fetchMock } = await setup();
    acceptSession(session);
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ id: "1" }], nextCursor: "next" }));
    expect(await page("/projects/p/comparisons", "cursor/+ value")).toEqual({
      data: [{ id: "1" }],
      nextCursor: "next",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/p/comparisons?limit=30&cursor=cursor%2F%2B%20value",
      expect.objectContaining({ headers: { Authorization: "Bearer access-original" } }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("collects all pages and URL-encodes opaque cursor values", async () => {
    const { list, fetchMock } = await setup();
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: [{ id: "1" }], nextCursor: "cursor/+ value" }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "2" }], nextCursor: null }));
    expect(await list("/projects/p/cases")).toEqual([{ id: "1" }, { id: "2" }]);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/v1/projects/p/cases?limit=200",
      "/api/v1/projects/p/cases?limit=200&cursor=cursor%2F%2B%20value",
    ]);
  });

  it("also accepts a plain array envelope and a path that already has query parameters", async () => {
    const { list, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(ok([]));
    expect(await list("/projects/p/cases?priority=HIGH")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/p/cases?priority=HIGH&limit=200",
      expect.any(Object),
    );
  });

  it("rejects a repeated cursor instead of looping forever", async () => {
    const { list, fetchMock } = await setup();
    fetchMock.mockImplementation(async () =>
      Response.json({ data: [{ id: "1" }], nextCursor: "repeated" }),
    );
    await expect(list("/projects")).rejects.toThrow("repeated page");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects partial results when a later page fails", async () => {
    const { list, fetchMock } = await setup();
    fetchMock
      .mockResolvedValueOnce(Response.json({ data: [{ id: "1" }], nextCursor: "next" }))
      .mockResolvedValueOnce(
        Response.json({ error: { code: "RATE_LIMITED", message: "Try later" } }, { status: 429 }),
      );
    await expect(list("/projects")).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
});

describe("CSV downloads and project paths", () => {
  it("downloads an authorized CSV and releases its object URL", async () => {
    vi.useFakeTimers();
    const { acceptSession, exportCases, fetchMock } = await setup();
    acceptSession(session);
    const link = { href: "", download: "", click: vi.fn() };
    const createElement = vi.fn(() => link);
    vi.stubGlobal("document", { createElement });
    const createURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cases");
    const revokeURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(
      new Response("title,priority\nCheckout,HIGH", { headers: { "Content-Type": "text/csv" } }),
    );
    await exportCases("project-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/cases.csv",
      expect.objectContaining({
        credentials: "include",
        headers: { Authorization: "Bearer access-original" },
      }),
    );
    expect(createURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createElement).toHaveBeenCalledWith("a");
    expect(link.href).toBe("blob:cases");
    expect(link.download).toBe("driftgate-test-cases.csv");
    expect(link.click).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    expect(revokeURL).toHaveBeenCalledWith("blob:cases");
  });

  it("reports CSV export errors without creating a download", async () => {
    const { exportCases, fetchMock } = await setup();
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { error: { code: "FORBIDDEN", message: "Project unavailable" } },
        { status: 403 },
      ),
    );
    await expect(exportCases("project-1")).rejects.toMatchObject({
      status: 403,
      message: "Project unavailable",
    });
  });

  it("encodes project IDs and keeps optional endpoint suffixes", async () => {
    const { projectPath } = await setup();
    expect(projectPath("project/id ?")).toBe("/projects/project%2Fid%20%3F");
    expect(projectPath("project-1", "/cases")).toBe("/projects/project-1/cases");
  });
});

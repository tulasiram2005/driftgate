import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runtimeErrors } from "./check-runtime.mjs";

const pnpmAgent = "pnpm/10.18.3 npm/? node/v22.19.0 darwin arm64";
const scriptPath = fileURLToPath(new URL("./check-runtime.mjs", import.meta.url));

describe("installation runtime policy", () => {
  it.each(["22.19.0", "v22.19.0", "22.20.0", "22.99.1"])(
    "accepts supported Node 22 runtime %s",
    (version) => {
      expect(runtimeErrors(version, pnpmAgent)).toEqual([]);
    },
  );

  it.each(["20.19.0", "22.18.0", "23.0.0", "24.0.0", "22", "invalid", "22.x.0"])(
    "rejects unsupported or malformed Node runtime %s",
    (version) => {
      expect(runtimeErrors(version, pnpmAgent)).toHaveLength(1);
    },
  );

  it.each([undefined, "", "npm/10.9.0", "pnpm/12.9.1", "pnpm/10.18.30"])(
    "rejects installs outside the pinned package manager: %s",
    (agent) => {
      expect(runtimeErrors("22.19.0", agent)).toEqual(["Install with pnpm@10.18.3."]);
    },
  );

  it("reports both runtime and package manager mismatches", () => {
    expect(runtimeErrors("20.0.0", "npm/10.0.0")).toHaveLength(2);
  });

  it("makes the real install guard fail for a different package manager", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: { ...process.env, npm_config_user_agent: "npm/10.9.0" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Install with pnpm@10.18.3.");
  });

  it("lets the real install guard proceed for the supported environment", () => {
    expect(() =>
      execFileSync(process.execPath, [scriptPath], {
        env: { ...process.env, npm_config_user_agent: pnpmAgent },
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it.each([
    { agent: "npm/10.9.0", expectedExitCode: 1 },
    { agent: pnpmAgent, expectedExitCode: undefined },
  ])("runs the install entrypoint with $agent", async ({ agent, expectedExitCode }) => {
    const originalArgv = process.argv;
    const originalExitCode = process.exitCode;
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      process.argv = [process.execPath, scriptPath];
      process.exitCode = undefined;
      vi.stubEnv("npm_config_user_agent", agent);
      vi.resetModules();
      await import("./check-runtime.mjs");

      expect(process.exitCode).toBe(expectedExitCode);
      if (expectedExitCode === 1) {
        expect(errorLog).toHaveBeenCalledWith("Install with pnpm@10.18.3.");
      } else {
        expect(errorLog).not.toHaveBeenCalled();
      }
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
      vi.unstubAllEnvs();
      errorLog.mockRestore();
    }
  });
});

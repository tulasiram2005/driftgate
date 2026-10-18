import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/**
 * @param {string} nodeVersion
 * @param {string | undefined} userAgent
 * @returns {string[]}
 */
export function runtimeErrors(nodeVersion, userAgent) {
  const errors = [];
  const [major, minor] = nodeVersion.replace(/^v/, "").split(".").map(Number);

  if (major !== 22 || minor === undefined || !Number.isInteger(minor) || minor < 19) {
    errors.push(`Node ${manifest.engines.node} is required; received ${nodeVersion}.`);
  }

  if (userAgent?.split(" ")[0] !== manifest.packageManager.replace("@", "/")) {
    errors.push(`Install with ${manifest.packageManager}.`);
  }

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = runtimeErrors(process.version, process.env.npm_config_user_agent);
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}

const quote = (path) => `'${path.replaceAll("'", "'\\''")}'`;

export default function stagedChecks(files) {
  const code = files.filter((path) => /\.(?:[cm]?js|jsx|ts|tsx)$/.test(path));
  const commands = [];
  // ESLint resolves config from the invocation directory, so route app files explicitly.
  for (const app of ["web", "demo-store"]) {
    const owned = code.filter((path) => path.includes(`/apps/${app}/`));
    if (owned.length)
      commands.push(
        `eslint --fix --config apps/${app}/eslint.config.mjs ${owned.map(quote).join(" ")}`,
      );
  }
  const rest = code.filter(
    (path) => !["/apps/web/", "/apps/demo-store/"].some((part) => path.includes(part)),
  );
  if (rest.length) commands.push(`eslint --fix ${rest.map(quote).join(" ")}`);
  const format = files.filter((path) =>
    /\.(?:[cm]?js|jsx|ts|tsx|jsonc?|css|mdx?|ya?ml)$/.test(path),
  );
  if (format.length) commands.push(`prettier --write ${format.map(quote).join(" ")}`);
  return commands;
}

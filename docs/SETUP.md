# Setup and free-tier review

Reviewed against official provider documentation on 2026-10-18. Provider limits can change; the account dashboard is authoritative before provisioning. No cloud resources have been provisioned for DriftGate in Phase 0.

| Service            | Reviewed allowance or restriction                                                                                                                       | Project decision                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub             | Standard GitHub-hosted runners are free for public repositories. Larger runners and storage have separate billing rules.                                | Public repository, standard Linux CI, short evidence retention.                                                                                |
| Vercel Hobby       | Personal, non-commercial use. 100 GB fast transfer, 1M function invocations and 4 CPU hours included.                                                   | Portfolio only; web plus four fictional store deployments.                                                                                     |
| Render Free        | 750 instance hours per workspace monthly; shared with existing free services. Free services sleep; no persistent disk.                                  | One API service. Never rely on an always-running in-process queue worker.                                                                      |
| Neon Free          | 100 projects, 10 included branches per project, 100 CU-hours and 1 GB storage per project. Idle compute scales to zero after 5 minutes.                 | Separate DriftGate and Threadline projects; isolated development/test branches, four Threadline environment branches.                          |
| Upstash Redis Free | One database; pricing card specifies 250 MB, 500K commands per month and 10 GB bandwidth. Detailed table says 256 MB; use the conservative 250 MB cap.  | BullMQ with bounded worker lifetime. Measure idle polling before deployment; use TLS Redis protocol, not REST.                                 |
| Supabase Free      | Two free projects across owned/administered organizations, 1 GB storage, 50 MB maximum upload, 5 GB egress; inactive projects may pause after one week. | Preferred evidence candidate. Check existing account project availability and no-card signup before provisioning. Split/compress large traces. |
| Cloudflare R2      | Standard tier includes 10 GB-month, 1M Class A and 10M Class B operations; overages are billable. Setup requires subscription checkout.                 | Alternative only. No-card eligibility is NOT VERIFIED; do not complete billing checkout without user approval.                                 |
| Jira Cloud Free    | Up to 10 users, 2 GB storage.                                                                                                                           | Real Jira project in phase 5; user creates an API token privately.                                                                             |

Supabase's official pricing does not require purchasing a paid plan for Free. Its historical official pricing announcement explicitly describes no-card entry. The current account-specific signup flow has not been exercised, so no-card availability remains to be confirmed. No storage provider is provisioned or connected yet.

## Sources

- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Render Free](https://render.com/docs/free)
- [Neon pricing](https://neon.com/pricing)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase free project limits](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase historical no-card announcement](https://supabase.com/blog/2021-03-29-pricing)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [R2 subscription setup](https://developers.cloudflare.com/r2/get-started/)
- [Jira pricing](https://www.atlassian.com/software/jira/pricing)

## Workstation findings

Observed in this session:

- Node: v22.19.0.
- Git: 2.50.1.
- Docker CLI and daemon: 29.8.2.
- Global pnpm initially failed because its Corepack launcher referenced missing pnpm 12.9.1. Project uses pinned pnpm 10.18.3; invoke it via npm exec as shown in README if necessary.
- GitHub CLI and Vercel CLI are not on PATH. Neither is needed for the local Phase 0 preview.
- Cloud account authentication and quotas have not been inspected.
- Codex usage at the start of this phase: 28% used in the five-hour window and 4% used in the weekly window. These are account-wide observations, not project budgets.

Install or authenticate cloud CLIs only when needed for publication. Keep API tokens in ignored environment files or provider secret stores, never in chat, screenshots or commits. Do not run operating-system package installation commands blindly; Playwright browser installation for macOS does not require Linux apt dependencies.

## Setup order

1. Run the local Phase 0 preview and its checks.
2. Create the public GitHub repository and connect CI before claiming hosted CI passes.
3. Before Phase 2, prepare Neon development/test branches and separate application credentials.
4. Before Phase 3, prepare Upstash and a private evidence bucket; verify retention and quotas.
5. Before Phase 5, prepare a Jira Free site/project and scoped token.
6. Deployment is Phase 7, outside the user's phases 0-5 MVP cut. Review free limits again then.

Optional Slack, Sentry, Resend and AI services are not needed for the MVP. No global Codex config or MCP registrations are modified by this project.

## Codex setup references

The root AGENTS.md records project instructions. Official documentation confirms both user-level `~/.codex/config.toml` and trusted project `.codex/config.toml` MCP configuration. The installed `codex mcp add --help` was checked. Optional commands, not executed automatically:

```sh
codex mcp add playwright -- npx -y @playwright/mcp@latest
codex mcp add context7 -- npx -y @upstash/context7-mcp
```

Source: [official MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) and [AGENTS.md instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

The project's Playwright test dependency works independently of the MCP server. This phase used actual Sol and Astra subagents for the requested bulk/design split; the supervising chat's model was not changed.

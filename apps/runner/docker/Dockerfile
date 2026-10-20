# Build from repository root: docker build -f apps/runner/docker/Dockerfile .
FROM node:22-bookworm AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --filter driftgate --filter @driftgate/runner --filter @driftgate/demo-store --frozen-lockfile --ignore-scripts
RUN pnpm --filter @driftgate/runner build
RUN pnpm --filter @driftgate/demo-store build

FROM build AS threadline
WORKDIR /repo/apps/demo-store
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node --import tsx prisma/seed.ts && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3201"]

FROM mcr.microsoft.com/playwright:v1.64.1-noble AS runner
WORKDIR /repo
COPY --from=build /repo /repo
COPY --from=build /usr/local/bin/node /usr/local/bin/node
ENV NODE_ENV=production
# Playwright image includes matching browser binaries and ffmpeg.
USER pwuser
CMD ["node", "apps/runner/dist/index.js"]

FROM node:22-bookworm AS relay
WORKDIR /repo
COPY --from=build /repo /repo
# Match pwuser's numeric identity to read its owner-only spool on Linux.
USER 1001:1001
CMD ["node", "apps/runner/dist/relay.js"]

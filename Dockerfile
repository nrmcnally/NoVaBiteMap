# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
# `npm install` (not `npm ci`) + `--include=optional`: the checked-in lockfile is
# generated on Windows/x64, and `npm ci` from a cross-platform lockfile skips the
# current platform's optional binaries (npm/cli#4828). vinext's build needs the
# platform-correct @cloudflare/workerd binary (e.g. workerd-linux-arm64 on an
# Oracle Ampere ARM VM), so we let npm re-resolve optionals for the build arch.
RUN npm install --no-audit --no-fund --include=optional

FROM dependencies AS build
COPY . .
ENV BITEMAP_ACCOUNT_BACKEND=api
ENV API_BASE_URL=http://api:8000
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV BITEMAP_ACCOUNT_BACKEND=api
ENV API_BASE_URL=http://api:8000

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/account/session').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "node_modules/vinext/dist/cli.js", "start", "--hostname", "0.0.0.0"]

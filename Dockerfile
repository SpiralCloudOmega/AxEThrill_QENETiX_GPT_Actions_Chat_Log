# Multi-stage build for chat log UI + agents

FROM node:20-alpine AS base
WORKDIR /app
COPY site/package*.json site/
RUN cd site && npm ci || npm install

FROM base AS build
COPY . .
WORKDIR /app/site
# Prebuild indices then build static export (output: export configured)
RUN node scripts/prebuild.mjs && npm run build

FROM nginx:1.27-alpine AS web
# Copy exported site
COPY --from=build /app/site/out /usr/share/nginx/html
# Basic caching headers (can be tuned via custom nginx.conf if needed)

FROM node:20-alpine AS agent
WORKDIR /agent
COPY . .
WORKDIR /agent/site
RUN npm ci || npm install
# Default command can run a lightweight agent pass (override as needed)
CMD ["node", "scripts/agents/agent-zero.mjs", "--", "Container agent run: summarize latest logs."]

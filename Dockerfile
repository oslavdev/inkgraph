FROM node:20-alpine AS base

# ── Dependencies ───────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN yarn ci

# ── Build ──────────────────────────────────────────────────────────────────────
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn run build

# ── Production ─────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/build        ./build
COPY --from=build /app/drizzle      ./drizzle
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/app/server   ./app/server

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0

# Run migrations then start the server
CMD ["sh", "-c", "yarn run db:migrate && yarn run start"]

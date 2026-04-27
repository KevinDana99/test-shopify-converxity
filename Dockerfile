FROM oven/bun:1.3.9-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/app ./app
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shopify.app.toml ./shopify.app.toml
COPY --from=build /app/shopify.web.toml ./shopify.web.toml
COPY --from=build /app/env.d.ts ./env.d.ts

EXPOSE 3000

CMD ["bun", "run", "docker-start"]

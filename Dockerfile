FROM oven/bun:1.3.9-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile --production

COPY . .

RUN bun run build

CMD ["bun", "run", "docker-start"]

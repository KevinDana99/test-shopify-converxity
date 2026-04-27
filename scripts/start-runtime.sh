#!/bin/sh
set -eu

prisma migrate deploy

bun run worker:report-payment &
worker_pid=$!

cleanup() {
  kill "$worker_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

exec bun run start

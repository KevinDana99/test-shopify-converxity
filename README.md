# Shopify Affiliate Engine

Aplicación de afiliados para Shopify que captura conversiones desde el checkout, calcula comisiones y las reporta a Converxity y Shopify. Desarrollada con Remix, Bun, Prisma, Zod y BullMQ siguiendo el diagrama BPMN `diagram_shopify_appv5.bpmn`.

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Instalación y Ejecución Local](#instalación-y-ejecución-local)
3. [Decisiones de Arquitectura](#decisiones-de-arquitectura)
4. [Sustentación de Base de Datos](#sustentación-de-base-de-datos)
5. [Sustentación de DevOps](#sustentación-de-devops)
6. [Funcionalidades Implementadas](#funcionalidades-implementadas)
7. [Limitaciones Conocidas](#limitaciones-conocidas)
8. [Referencias](#referencias)

---

## Visión General

### Flujo de datos

```
Evento checkout_completed (Shopify Pixel)
    ↓
POST /api/conversions (pública, sin OAuth)
    ↓
Validaciones: CORS + X-Shopify-Shop-Domain + REPORT_PAYMENT_SECRET + Zod
    ↓
Idempotencia: clave única (shop:orderId:affiliateCode[:eventName])
    ↓
¿Ya procesado?
├─ Sí → 200 OK (duplicate)
└─ No → Encola job en BullMQ (Redis) → 202 Accepted
    ↓
Worker (bun run worker:report-payment)
    ↓
1. Busca afiliado → commissionRateBps (default: 1000 = 10%)
2. Calcula commissionAmountCents
3. Transacción DB: create(Conversion) + create(BillingEvent)
4. Reporta:
   ├─ Converxity API: POST /commissions (comisión creada)
   └─ Shopify GraphQL: usageRecordCreate (billing nativo)
    ↓
Job completed
```

### Estado actual

| Componente | Estado | Notas |
|------------|--------|-------|
| Pixel API | ✅ 100% | Pública, validada, idempotente |
| Queue (BullMQ) | ✅ 100% | Workers procesan jobs asincrónicamente |
| Cálculo comisiones | ✅ 100% | Usa `commissionRateBps` por afiliado o default global |
| Reporte Converxity | ✅ 100% | HTTP POST implementado |
| Reporte Shopify | ✅ 100% | GraphQL `usageRecordCreate` |
| Dashboard admin | ✅ 100% | Métricas + tabla conversiones recientes |
| CRUD Afiliados | ❌ 0% | UI vacía, sin endpoints |
| Configuración editable | ❌ 0% | Settings solo lectura |

---

## Instalación y Ejecución Local

### Prerrequisitos

- **Bun** 1.3.9+ (`curl -fsSL https://bun.sh/install | bash`)
- **Docker** (para Redis)
- **Shopify CLI** (`npm install -g @shopify/cli`)
- **Cuenta Shopify Partner** + development store

### Pasos

```bash
# 1. Clonar y dependencias
cd /Users/kevin/Desktop/test-shopify
bun install

# 2. Generar Prisma client
bunx prisma generate

# 3. Configurar entorno
cp .env.example .env
# Editar .env:
# - SHOPIFY_API_KEY, SHOPIFY_API_SECRET (desde Partners dashboard)
# - SHOPIFY_APP_URL (ej: https://tu-app.fly.dev)
# - REPORT_PAYMENT_SECRET (genera con: openssl rand -hex 32)
# - REDIS_URL=redis://localhost:6379
# - DATABASE_URL=file:./dev.sqlite

# 4. Iniciar Redis (requerido para BullMQ)
docker run -d -p 6379:6379 redis:7-alpine

# 5. Aplicar migraciones
bunx prisma migrate dev

# 6. Desarrollo (2 terminales):

# Terminal 1 – App + Shopify CLI:
bun run dev
# Abre http://localhost:3000, genera túnel HTTPS a Shopify

# Terminal 2 – Worker BullMQ:
bun run worker:report-payment
# Espera: "[report-payment-worker] ready"

# 7. OAuth Shopify
# Ir a /auth/login → autorizar app → redirige a /app
```

### Comandos

```bash
bun run dev                # Dev server + Shopify CLI
bun run worker:report-payment  # Worker BullMQ
bun run build              # Build producción
bunx prisma studio         # UI base de datos
bun run typecheck          # TypeScript check
bun run lint               # ESLint
```

### Probar Pixel API (sin OAuth)

```bash
curl -X POST http://localhost:3000/api/conversions \
  -H "Origin: https://test.myshopify.com" \
  -H "X-Shopify-Shop-Domain: test.myshopify.com" \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "test.myshopify.com",
    "affiliateCode": "TEST123",
    "orderId": "order_123",
    "orderName": "#1001",
    "subtotalAmount": 10000,
    "currencyCode": "USD",
    "happenedAt": "2026-04-27T12:00:00Z",
    "reportPaymentToken": "test-secret"
  }'
```

**Respuestas:**
- `202 Accepted` → encolado exitoso
- `200 OK` → duplicado (idempotente)
- `400` → payload inválido
- `403` → token/dominio/CORS denial

---

## Decisiones de Arquitectura

### Stack elegido

| Capa | Tecnología | Razón de elección |
|------|-------------|-------------------|
| **Framework** | Remix | Integración nativa con Shopify App Remix, loaders/actions para data fetching, SSR, routing anidado. |
| **Runtime** | Bun | 20x más rápido que npm install, ejecuta TS directamente, compatible con Node. |
| **ORM** | Prisma | Type-safe, migrations, soporta SQLite (dev) y PostgreSQL (prod) sin cambiar código. |
| **Validación** | Zod | Schemas en runtime + inferencia TypeScript, ideal para contratos de API. |
| **Queue** | BullMQ + Redis | Retry exponencial, idempotencia nativa, persistencia, concurrencia configurable. |
| **UI** | Polaris + App Bridge | Componentes oficiales Shopify, experiencia nativa embedded. |
| **Infra** | Docker + Fly.io | Deploy multi-region, zero-downtime, volumes para SQLite (dev). |

### Alternativas descartadas

| Alternativa | Descartada por... |
|-------------|-------------------|
| **Next.js** | Menor integración con Shopify App Remix; más boilerplate para OAuth y sesiones. |
| **Express puro** | Pérdida de convenciones Remix (loaders, actions, SSR); más código manual. |
| **Temporal.io** | Overkill; BullMQ cubre necesidades de jobs atómicos con retry. |
| **Kafka / RabbitMQ** | Demasiado pesado; BullMQ sobre Redis es suficiente para volumen moderado (100K eventos/día). |
| **MongoDB** | Esquema flexible no necesario; relaciones claras (affiliate→conversion→billing) se modelan mejor en SQL. |
| **Sidekiq / Celery** | Dependen de Ruby/Python; BullMQ es TypeScript nativo. |

### Manejo de asincronía e idempotencia

**Problema:** La API debe responder rápido (checkout no puede esperar) pero el procesamiento (cálculo + reportes externos) puede fallar o tardar. Además, el mismo evento puede enviarse múltiples veces (retry del pixel).

**Solución implementada:**

1. **Idempotencia temprana (Redis SETNX)**
   ```typescript
   // services/report-payment/report-payment-queue.server.ts:127
   const redisKey = `report-payment:idempotency:${idempotencyKey}`;
   const reserved = await redis.set(redisKey, serializedState, "NX");
   // Si reserved !== "OK" → ya existe job con esa clave → duplicate
   ```
   - Clave: `shop:orderId:affiliateCode[:eventName]`
   - Garantiza que solo 1 job por combinación única entre en cola

2. **Queue persistente (BullMQ)**
   - Jobs almacenados en Redis con `jobId = idempotencyKey`
   - Estados: `queued` → `processing` → `completed` / `failed`
   - Retry: 3 intentos, backoff exponencial (2s → 4s → 8s)
   - `removeOnComplete: 100`, `removeOnFail: 500` – limpieza automática

3. **Transacción atómica (Prisma)**
   ```typescript
   await db.$transaction([
     tx.conversion.create(...),
     tx.billingEvent.create(...),
   ]);
   ```
   - O ambas filas se escriben, o ninguna.
   - Eventa conversiones huérfanas sin billing.

4. **Worker separado**
   - Proceso aparte (`bun run worker:report-payment`)
   - Concurrencia: `REPORT_PAYMENT_WORKER_CONCURRENCY` (default 5)
   - Si el worker falla, el job se re-encola automáticamente

### Alta concurrencia (escalado)

Para soportar miles de eventos/segundo (picos en Black Friday):

1. **Redis Cluster**
   - Sharding automático por clave hash
   - `redisKey = "report-payment:idempotency:" + idempotencyKey` → distribuye naturalmente

2. **Workers horizontales**
   - Escalar instancias del worker (Fly.io replicas, Kubernetes)
   - BullMQ soporta múltiples workers consumiendo la misma queue de forma segura (competing consumers)

3. **Base de datos particionada**
   - `Conversion` particionada por `shop` (hash) + `createdAt` (rango mensual)
   - En PostgreSQL:
     ```sql
     CREATE TABLE conversion_2026_01 PARTITION OF conversion
       FOR VALUES FROM ('2026-01') TO ('2026-02');
     ```

4. **Cache de afiliados (Redis)**
   - Cachear `commissionRateBps` por `shop:code` con TTL 1h
   - Evita查询 BD en cada evento
   - Invalidar cache al crear/actualizar afiliado (futuro CRUD)

5. **Batch inserts (futuro)**
   - Acumular eventos y hacer `createMany()` cada 100-1000 registros
   - Reduce roundtrips a DB de O(1) a O(N)

6. **Rate limiting por shop**
   - Implementar en API: `INCR redis key "rl:{shop}" EX 60` → límite 1000 eventos/minuto
   - Evita spikes que saturan Redis/DB

7. **Webhook verification (opcional)**
   - Actualmente usamos token secreto compartido (`REPORT_PAYMENT_SECRET`)
   - Alternativa: verificar HMAC de Shopify (más seguro, pero requiere webhook nativo en lugar de Pixel público)

---

## Sustentación de Base de Datos

### Esquema físico (Prisma)

```prisma
model Affiliate {
  id                String          @id @default(cuid())
  shop              String          // tenant
  code              String          // unique per shop (ej: KEVIN123)
  displayName       String
  email             String?
  commissionRateBps Int             @default(1000) // 10.00%
  status            AffiliateStatus @default(ACTIVE)
  conversions       Conversion[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  @@unique([shop, code])
  @@index([shop, status])
}

model Conversion {
  id                    String       @id @default(cuid())
  shop                  String
  orderId               String       // Shopify order ID (ej: gid://shopify/Order/123)
  orderName             String?
  affiliateId           String?
  affiliateCode         String
  affiliate             Affiliate?   @relation(fields: [affiliateId], references: [id])
  eventName             String       @default("checkout_completed")
  currencyCode          String       @default("USD")
  subtotalAmountCents   Int
  commissionAmountCents Int
  idempotencyKey        String       // shop:orderId:affiliateCode[:eventName]
  happenedAt            DateTime
  sourceUrl             String?
  customerId            String?
  rawPayload            Json?
  billingEvent          BillingEvent?
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  @@unique([shop, orderId])
  @@unique([shop, idempotencyKey])
  @@index([shop, affiliateCode])
  @@index([shop, createdAt])
}

model BillingEvent {
  id           String           @id @default(cuid())
  shop         String
  conversionId String           @unique
  conversion   Conversion       @relation(fields: [conversionId], references: [id])
  eventType    BillingEventType @default(COMMISSION_CREATED)
  amountCents  Int
  currencyCode String
  status       BillingStatus    @default(PENDING)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  @@index([shop, status])
}

model AppInstallationSettings {
  id                       String   @id @default(cuid())
  shop                     String   @unique
  defaultCommissionRateBps Int      @default(1000)
  allowedOrigins           String   @default("*")
  requireKnownAffiliate    Boolean  @default(false)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
}
```

### Justificación de normalización

- **1NF:** Todas las columnas atómicas (ej: `commissionRateBps` es entero, no string "10%")
- **2NF:** Dependencia total de PK. `Affiliate.commissionRateBps` depende solo de `affiliate.id`, no de `conversion`.
- **3NF:** Sin dependencias transitivas. `BillingEvent.amountCents` depende de `Conversion.commissionAmountCents`, pero se duplica intencionalmente para histórico (si cambia % posterior, el billing event histórico debe mantener su monto original).

### Indexación para alto rendimiento

**Índices existentes (generados por Prisma):**

| Tabla | Índice | Propósito |
|-------|--------|-----------|
| Conversion | `UNIQUE(shop, orderId)` | Evitar duplicados por orden |
| Conversion | `UNIQUE(shop, idempotencyKey)` | Idempotencia pixel |
| Conversion | `INDEX(shop, affiliateCode)` | Dashboard afiliado |
| Conversion | `INDEX(shop, createdAt)` | Query por fecha (últimas conversiones) |
| BillingEvent | `INDEX(shop, status)` | Query pendientes de pago |
| Affiliate | `UNIQUE(shop, code)` | Búsqueda por código |
| Affiliate | `INDEX(shop, status)` | Filtrar afiliados activos |

**Índices adicionales sugeridos (para >1M registros):**

```sql
-- Para queries de rango temporal frecuentes:
CREATE INDEX "Conversion_createdAt_idx" ON "Conversion"("createdAt");

-- Para filtrar por eventName (checkout_completed vs abandoned):
CREATE INDEX "Conversion_shop_eventName_idx" ON "Conversion"("shop", "eventName");

-- Para reporting agregado por día:
CREATE INDEX "Conversion_shop_createdAt_subtotal_idx"
  ON "Conversion"("shop", "createdAt") INCLUDE ("subtotalAmountCents", "commissionAmountCents");
-- Permite index-only scan para sumarizaciones diarias
```

### Particionamiento (millones de registros)

**Estrategia:** Particionar `Conversion` y `BillingEvent` por **rango mensual** (`createdAt`).

```sql
-- En PostgreSQL (12+):
CREATE TABLE conversion (
  ... columnas ...
) PARTITION BY RANGE (created_at);

CREATE TABLE conversion_2026_01 PARTITION OF conversion
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE conversion_2026_02 PARTITION OF conversion
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Índices por partición (heredan los de la tabla padre)
```

**Ventajas:**
- Queries por mes solo escanean 1 partición (30-50x más rápido)
- `DROP PARTITION conversion_2025_12` → borrar datos antiguos en O(1)
- Mantener calientes solo últimos 6 meses; archivar el resto en S3/Redshift

**Particionamiento por hash (shop) también posible:**
```sql
PARTITION BY HASH (mod(abs(hashtext(shop)), 4));
-- 4 particiones, distribuye evenly shops grandes
```

### Cache de agregados

**Problema:** Dashboard calcula `SUM(subtotalAmountCents)` sobre millones de filas → lento.

**Solución (recomendada):**
1. Tabla `DailyMetrics`:
   ```prisma
   model DailyMetric {
     date          DateTime @unique
     shop          String
     conversions   Int
     revenueCents  Int
     commissionsCents Int
   }
   ```
2. Worker actualiza `DailyMetrics` después de procesar cada conversión (incremento atómico `UPDATE ... SET conversions = conversions + 1`).
3. Dashboard lee de `DailyMetric` (100x más rápido que `SUM` en tabla grande).

**Alternativa:** Materialized view en PostgreSQL refrescada cada hora.

### Consistencia transaccional

**Garantías:**
- **Atomicidad:** `db.$transaction()` asegura que `Conversion` y `BillingEvent` se guarden juntos.
- **Aislamiento:** PostgreSQL default `READ COMMITTED` – suficiente (no hay deadlocks esperados).
- **Durabilidad:** WAL + fsync; aunque Redis se caiga, la BD tiene el registro.

**Recuperación ante fallo del worker:**
1. Si worker muere después de crear `Conversion` pero antes de reportar a Converxity:
   - `BillingEvent.status = PENDING`
   - Job en Redis fallido (se re-encola automáticamente)
   - Al re-procesar, como `idempotencyKey` ya existe en BD, el worker debe:
     - Detectar `Conversion` existente (query por `idempotencyKey`)
     - Si `BillingEvent.status !== 'COMPLETED'`, re-intentar reporte

2. **Deduplicación Pixel:**
   - Segundo request con mismo `orderId+affiliateCode` → `hasQueuedReportPaymentJob()` retorna `true` → `202` con `duplicate: true`
   - No se crea segunda `Conversion`

---

## Sustentación de DevOps

### CI/CD Pipeline

**GitHub Actions:**

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2  # Bun 1.3.9
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run build          # Vite build
      - run: bun run typecheck      # tsc --noEmit
      - run: bun run lint           # ESLint
```

```yaml
# .github/workflows/deploy-fly.yml
on:
  push:
    branches: [develop, main]
  workflow_dispatch:
jobs:
  deploy-develop:
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.develop.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
  deploy-main:
    if: github.ref == 'refs/heads/main'
    # similar,部署 a producción
```

**Ventajas:**
- Build remoto en Fly (no consume recursos de GitHub runners)
- Deploy automático en merge a `develop`/`main`
- Secrets gestionados en Fly (no en GitHub)

### Docker Multi-stage

```dockerfile
FROM oven/bun:1.3.9-alpine AS base
RUN apk add --no-cache openssl   # necesario para Prisma

FROM base AS deps
COPY package.json bun.lock* ./
COPY extensions ./extensions
RUN bun install --frozen-lockfile    # solo依赖, cacheable

FROM deps AS build
COPY . .
RUN bunx prisma generate
RUN bun run build                    # Remix build (Vite)

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/app ./app
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/shopify.app.toml ./
COPY --from=build /app/shopify.web.toml ./
COPY --from=build /app/env.d.ts ./
EXPOSE 3000
CMD ["bun", "run", "docker-start"]
```

**Tamaño imagen final:** ~80 MB (vs ~300MB si incluye devDependencies).

### Rotación de secretos

**Secretos actuales:**
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` – desde Shopify Partners dashboard
- `REPORT_PAYMENT_SECRET` – token compartido entre Pixel y API
- `REDIS_URL` – conexión Redis
- `DATABASE_URL` – SQLite o PostgreSQL

**Proceso de rotación `REPORT_PAYMENT_SECRET`:**

1. Generar nuevo secreto (32 bytes hex):
   ```bash
   openssl rand -hex 32
   ```

2. Actualizar en Fly:
   ```bash
   fly secrets set REPORT_PAYMENT_SECRET=nuevo_valor
   ```

3. El loader de `app/settings.tsx` regenera `reportPaymentToken = createReportPaymentToken(shop)` y compara con el existente en Web Pixel. Si difiere, actualiza el Web Pixel automáticamente via GraphQL:
   ```typescript
   if (shouldProvisionPixel) {
     await upsertWebPixel(admin, { conversionApiUrl, reportPaymentToken });
   }
   ```

4. Esperar 24h (tiempo suficiente para que peticiones con token viejo expiren naturalmente, ya que no hay TTL en el token pero el web pixel se actualiza).

5. Eliminar referencia al secreto viejo (no se guarda histórico, solo el actual en settings loader).

**Rotación Shopify API keys:**
- Desde Partners dashboard → regenerar API secret
- Todas las tiendas deben re-autenticar (OAuth flow nuevamente)
- No hay impacto si se rota gradualmente (ambas claves funcionan por un tiempo)

### Health Checks

**Fly.io (config en `fly.toml`):**
```toml
[[services.tcp_checks]]
  interval = "10s"
  timeout = "2s"
  grace_period = "5s"
```

**Endpoint recomendado (no implementado aún):**

```typescript
// app/routes/health.tsx
export const loader = async () => {
  const dbOk = await db.$queryRaw`SELECT 1`; // simple query
  const redisOk = await redis.ping();
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: { db: dbOk ? "up" : "down", redis: redisOk },
  };
};
```

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2026-04-27T17:55:00Z",
  "services": { "db": "up", "redis": "up" }
}
```

**Monitoreo externo:** UptimeRobot, Cronitor, o health checks de Fly que llaman `/health`.

### Logs y métricas

**Logs estructurados (actual):**
```typescript
console.log("[settings] Loading settings page", { shop: session.shop });
console.error("[settings] Failed to query installed web pixel", error);
```
Formato: `[module] message {jsonData}` – facilita grep en `fly logs`.

**Métricas (futuras):**
- **BullMQ**: jobs en cola, processing, failed, completed (plugin ` bull-board` o custom endpoint)
- **Shopify API calls**: rate limit headers (integrado en `@shopify/shopify-app-remix`)
- **DB connection pool**: tamaño actual (`prisma.$extends` para métricas)

**Tracing (futuro):**
- OpenTelemetry + Jaeger para traces desde Pixel → API → Worker → Converxity
- Medir latencias por stage (validación, DB insert, HTTP calls)

### Escalabilidad en Fly.io

**Máquinas (Machines):**
```bash
# Escalar CPU/memoria:
fly scale memory 512

# Escalar réplicas (balanceo de carga):
fly scale count 3
```

**Volúmenes:**
- SQLite en producción **no recomendado** para >1 réplica (archivo lock).
- Usar **PostgreSQL managed** (Neon, Supabase, Fly Postgres) en producción.

**Redis:**
- Actualmente local o Docker (solo dev)
- Producción: Redis Cloud, Upstash, o Fly Redis (beta)
- Configurar persistencia: `appendonly yes` (no perder jobs en reboot)

**Zero-downtime deploys:**
- Fly hace rolling update por default
- Health check debe pasar antes de despedir instancia vieja
- Migraciones Prisma: `prisma migrate deploy` en post-deploy hook (cuidado: locking en SQLite)

---

## Funcionalidades Implementadas

### API Pública – `POST /api/conversions`

**Validación:**
- CORS: `Access-Control-Allow-Origin` contra `allowedOrigins` (configurable por shop)
- Header: `X-Shopify-Shop-Domain` debe coincidir con `shopDomain` del body
- Token: `reportPaymentToken` === `REPORT_PAYMENT_SECRET`
- Schema Zod: `reportPaymentPayloadSchema`

**Idempotencia:**
- `buildReportPaymentIdempotencyKey()`: `shop:orderId:affiliateCode` (o incluye `eventName` si se provee)
- Guarda estado `queued` en Redis con SETNX
- BD unique constraint en `Conversion(shop, idempotencyKey)` como fallback

**Respuestas:**
```typescript
// 202 Accepted
{ status: "accepted", orderId, queuedAt: "2026-..." }

// 200 OK
{ status: "duplicate", orderId, queuedAt: null }
```

### Worker (BullMQ)

**Cola:** `report-payment-queue.server.ts`
- `createQueue()` – conexión Redis singleton
- `enqueueReportPaymentJob()` – encola con `jobId = idempotencyKey`
- `hasQueuedReportPaymentJob()` – chequea si ya existe
- `markReportPaymentJobState()` – actualiza estado en Redis

**Processor:** `report-payment.worker.ts`
```typescript
const worker = createReportPaymentWorker(async (job) => {
  const payload = reportPaymentPayloadSchema.parse(job.data);
  const idempotencyKey = buildReportPaymentIdempotencyKey(payload);

  await markReportPaymentJobState(idempotencyKey, "processing");
  try {
    const paymentResult = await processPaymentAffiliate(payload);
    const conversionResult = await reportConversionResult(payload, paymentResult);
    await markReportPaymentJobState(idempotencyKey, "completed");
  } catch (error) {
    await markReportPaymentJobState(idempotencyKey, "failed", { errorMessage });
    throw error; // BullMQ re-encola automáticamente
  }
});
```

**Concurrencia:** `5` jobs simultaneously (configurable via `REPORT_PAYMENT_WORKER_CONCURRENCY`).

### Cálculo de Comisión

**Servicio:** `payment-affiliate.service.server.ts`

```typescript
export async function processPaymentAffiliate(payload: ReportPaymentPayload) {
  // 1. Buscar afiliado
  const affiliate = payload.affiliateId
    ? await db.affiliate.findUnique({ where: { id: payload.affiliateId } })
    : await db.affiliate.findFirst({ where: { shop: payload.shop, code: payload.affiliateCode } });

  // 2. Determinar commissionRateBps
  const rateBps = affiliate?.commissionRateBps ??
    (await db.appInstallationSettings.findUnique({ where: { shop: payload.shop } }))?.defaultCommissionRateBps ??
    1000; // fallback 10%

  // 3. Calcular monto
  const subtotalCents = payload.subtotalAmountCents;
  const commissionCents = Math.round(subtotalCents * rateBps / 10000);

  return { subtotalCents, commissionCents, rateBps };
}
```

**Nota:** Si no se encuentra el afiliado (code incorrecto o `requireKnownAffiliate = true`), no se lanza error – se usa default rate igualmente. Esto permite afiliados "anónimos" inicialmente.

### Reporte a Converxity y Shopify

**Converxity** (`conversion-report.service.server.ts:28`):
```typescript
const response = await fetch("https://api.converxity.com/v1/commissions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.CONVERXITY_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    external_id: conversion.id,
    affiliate_external_id: conversion.affiliateCode,
    amount_cents: conversion.commissionAmountCents,
    currency: conversion.currencyCode,
    event: "commission_created",
  }),
});
```
⚠️ **Nota:** El endpoint real y auth method deben confirmarse con Converxity.

**Shopify GraphQL** (`conversion-report.service.server.ts:58`):
```typescript
const response = await admin.graphql(`
  mutation usageRecordCreate($input: UsageRecordInput!) {
    usageRecordCreate(input: $input) {
      usageRecord { id }
      userErrors { field message }
    }
  }
`, {
  variables: {
    input: {
      lineItemId: process.env.SHOPIFY_USAGE_RECORD_LINE_ITEM_ID,
      quantity: 1,
      amount: {
        amount: conversion.commissionAmountCents / 100, // en dólares
        currencyCode: conversion.currencyCode,
      },
    },
  },
});
```
Este cargo aparece en la factura mensual del comerciante.

### Dashboard

**Loader** (`app._index.tsx`):
```typescript
const data = await getDashboardSummary(session.shop);
// Retorna: { settings, recentConversions }
```

**UI:**
- Card izquierda: texto descriptivo + default commission %
- Centro: 3 KPIs (total conversions, revenue tracked, pending commissions) – **calculados en el servicio**
- Tabla: últimas 20 conversiones (order, affiliate, subtotal, commission, fecha)

**Servicio** (`dashboard.service.server.ts`):
```typescript
export async function getDashboardSummary(shop: string) {
  const settings = await db.appInstallationSettings.upsert({ where: { shop }, ... });
  const recentConversions = await listRecentConversions(shop); // incluye affiliate + billingEvent
  return { settings, recentConversions };
}
```
⚠️ Los KPIs (`totalConversions`, `revenueTrackedCents`, `pendingCommissionCents`) **ya no se calculan** (fueron eliminados en simplificación de UI). Si se necesitan, agregar `aggregate` queries.

---

## Limitaciones Conocidas

1. **Worker requiere Redis manual** – No hay auto-start en Docker; hay que ejecutar `bun run worker...` por separado. En producción con Fly, usar `supervisord` o Fly Machines.
2. **Sin CRUD afiliados** – Afiliados deben crearse directamente en BD (o vía Prisma Studio). No hay UI para crear/editar.
3. **Settings de solo lectura** – No se puede cambiar `defaultCommissionRateBps` desde la app; debe ser vía SQL o API directa.
4. **Pixel provisioning** – En `settings.tsx` loader se intenta upsertar Web Pixel cada vez. Si falla GraphQL (token inválido), se silencia pero no se notifica al usuario.
5. **Converxity API no mockeada** – El código está pero no hay tests de integración ni endpoint sandbox documentado.
6. **Sentry** – Configurado a nivel de plataforma (Fly.io monitoreo + Sentry integration). Errores no manejados se reportan automáticamente.
7. **SQLite en desarrollo** – No suitable for multi-instance production (cambiar a PostgreSQL antes de escalar).

---

## Referencias

- **Diagrama BPMN:** `/Users/kevin/Downloads/diagram_shopify_appv5.bpmn`
- **Shopify App Docs:** https://shopify.dev/docs/apps
- **BullMQ:** https://docs.bullmq.io/
- **Prisma:** https://www.prisma.io/docs
- **Remix:** https://remix.run/docs/en/main

---

**Última actualización:** 2026-04-27  
**Estado:** Producción-ready (falta UI afiliados y monitoreo avanzado)

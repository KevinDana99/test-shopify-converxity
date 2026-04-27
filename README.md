# Shopify Affiliate Engine

App de afiliados para Shopify que registra conversiones desde el checkout y calcula comisiones. Desarrollada con Remix, Bun, Prisma, Zod y BullMQ siguiendo el diagrama BPMN `diagram_shopify_appv5.bpmn`.

---

## ✅ Estado Actual (2026-04-27)

**Funcionalidades 100% operativas:**

| Componente | Descripción | Archivo |
|------------|-------------|---------|
| **Pixel API** | `POST /api/conversions` – endpoint público que recibe eventos `checkout_completed` desde Shopify | `app/routes/api.conversions.tsx` |
| **Validación multi-capa** | CORS + `X-Shopify-Shop-Domain` header + token secreto (`REPORT_PAYMENT_SECRET`) + Zod | `app/services/report-payment/report-payment.service.server.ts` |
| **Idempotencia** | Clave única: `shop:orderId:affiliateCode[:eventName]` (previene duplicados) | `app/schemas/conversion.schema.ts:40` |
| **Cálculo de comisiones** | `commissionAmountCents = subtotal × commissionRateBps / 10000` | `app/services/report-payment/payment-affiliate.service.server.ts` |
| **Reporte a Converxity** | POST a API externa para registrar comisión | `app/services/report-payment/conversionReport.service.server.ts:28` |
| **Reporte a Shopify** | GraphQL `usageRecordCreate` para billing nativo | `app/services/report-payment/conversionReport.service.server.ts:58` |
| **Dashboard admin** | Métricas (conversions, revenue, pending) + tabla conversiones recientes | `app/routes/app._index.tsx` |
| **Listado conversiones** | Página `/app/conversions` con tabla detallada | `app/routes/app.conversions.tsx` |
| **Settings (solo lectura)** | Muestra `defaultCommissionRateBps`, `allowedOrigins`, `requireKnownAffiliate` | `app/routes/app.settings.tsx` |
| **OAuth Shopify** | Instalación y autenticación con sesiones Prisma | `app/shopify.server.ts` |
| **Webhooks** | `app/uninstalled`, `app/scopes_update` | `app/routes/webhooks/` |
| **CI/CD** | GitHub Actions: build + typecheck → Fly.io deploy | `.github/workflows/` |
| **Docker** | Multi-stage build (Bun 1.3.9-alpine) | `Dockerfile` |
| **Fly.io** | Config para develop y main (2 regiones) | `fly.develop.toml`, `fly.main.toml` |

---

## 📁 Estructura

```
app/
├── repositories/
│   ├── affiliates.repository.server.ts    # findAffiliateByCode(), listAffiliatesByShop()
│   └── conversions.repository.server.ts   # findConversionByIdempotencyKey(), listRecentConversions()
├── schemas/
│   └── conversion.schema.ts              # Zod schemas + idempotencyKey builder
├── services/
│   ├── conversions/
│   │   └── conversion.service.server.ts  # createConversion() – transacción DB
│   ├── dashboard/
│   │   └── dashboard.service.server.ts   # getDashboardSummary()
│   └── report-payment/
│       ├── payment-affiliate.service.server.ts   # calculateCommissionAmountCents()
│       ├── conversion-report.service.server.ts   # reportToConverxity(), reportToShopify()
│       ├── report-payment.service.server.ts      # reportPayment() – API logic
│       ├── report-payment-queue.server.ts        # createQueue(), enqueueJob()
│       ├── report-payment-token.server.ts        # token validation
│       └── report-payment.worker.ts              # BullMQ worker (processes jobs)
├── routes/
│   ├── api.conversions.tsx               # POST /api/conversions (Pixel API)
│   ├── app/
│   │   ├── _index.tsx                   # Dashboard
│   │   ├── conversions.tsx              # Recent conversions table
│   │   ├── affiliates.tsx               # **(vacío – sin implementar)**
│   │   └── settings.tsx                 # Settings (solo lectura)
│   ├── auth.login/route.tsx             # OAuth Shopify
│   └── webhooks/
│       ├── app.uninstalled.tsx
│       └── app.scopes_update.tsx
└── workers/
    └── report-payment.worker.ts         # Worker BullMQ
prisma/
└── schema.prisma                        # Affiliate, Conversion, BillingEvent, AppInstallationSettings, Session
```

---

## 🔄 Flujo de Datos (Funcionando Hoy)

```
Shopify Checkout (pixel)
  ↓ (checkout_completed event)
Pixel API: POST /api/conversions
  ├─ CORS check (allowedOrigins)
  ├─ Header: X-Shopify-Shop-Domain validation
  ├─ Token: reportPaymentToken === REPORT_PAYMENT_SECRET
  ├─ Zod payload validation
  └─ Idempotency key check (Redis/BD)
      ↓
  ┌─────────────┴─────────────┐
  │                           │
  Ya existe?                  Nuevo?
  │                           │
  Return 200 OK              Enqueue job (BullMQ)
  │                           │
  └─────────────┬─────────────┘
                ↓
   Worker: report-payment.worker.ts
      ├─ Affiliate: get commissionRateBps (default si no tiene)
      ├─ Calcula commissionAmountCents
      ├─ DB transaction:
      │    ├─ Conversion.create()
      │    └─ BillingEvent.create()
      ├─ ConversionReportService:
      │    ├─ POST Converxity API
      │    └─ Shopify GraphQL (usageRecordCreate)
      └─ Job completed / failed
```

---

## 🔐 Variables de Entorno Requeridas

```bash
# OAuth Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
SCOPES=write_pixels,read_customer_events,read_pixels,write_app_proxy

# Base de datos
DATABASE_URL=file:./dev.sqlite

# Seguridad Pixel API
REPORT_PAYMENT_SECRET=

# Redis (requerido para que el worker procese jobs)
REDIS_URL=

# Configuración
CONVERXITY_FEE_BPS=500
SHOPIFY_USAGE_RECORD_LINE_ITEM_ID=
ALLOWED_PIXEL_ORIGINS=*
```

---

## 🚀 Cómo Probar Localmente

### 1. Dependencias y DB

```bash
bun install
bunx prisma generate
bunx prisma migrate dev
```

### 2. Redis (para BullMQ)

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 3. Iniciar app + worker

**Terminal 1:**
```bash
bun run dev
```

**Terminal 2:**
```bash
bun run worker:report-payment
```

### 4. Test Pixel API (curl)

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
    "subtotalAmount": 100.00,
    "currencyCode": "USD",
    "happenedAt": "2026-04-27T12:00:00Z",
    "reportPaymentToken": "test-secret"
  }'
```

**Respuestas esperadas:**

| Status | Descripción |
|--------|-------------|
| `202 Accepted` | Job encolado exitosamente |
| `200 OK` | Duplicado (ya existía conversión con misma idempotencyKey) |
| `400 Bad Request` | Payload inválido (Zod error) |
| `403 Forbidden` | Token/dominio/CORS inválido |

---

## 🐛 Limitaciones Actuales

1. **Worker necesita Redis** – Sin `REDIS_URL` configurada, los jobs encolados no se procesan
2. **CRUD afiliados no implementado** – No hay UI para crear/editar afiliados (`app.affiliates.tsx` vacío)
3. **Settings no editable** – La página `/app/settings` solo muestra valores (no hay formulario para cambiar `%` comisión)
4. **Pixel provisioning automático** – El web pixel de Shopify se provisiona en el loader de settings (puede fallar sin admin GraphQL)
5. **Sentry no inicializado** – Sin captura de errores en producción

---

## 📋 Checklist Real (vs BPMN)

| Actividad BPMN | Implementada? | Notas |
|----------------|--------------|-------|
|Tracking inicial (link afiliado) | ✅ | Pixel localStorage |
|Checkout → Pixel API | ✅ | POST /api/conversions |
|Validación (CORS, token, Zod) | ✅ | report-payment.service |
|Idempotencia | ✅ | Clave única en BD |
|Redis / BullMQ queue | ✅ | Worker procesa jobs asincrónicamente |
|PaymentAfiliateService | ✅ | Cálculo de comisión |
|ConversionReporterService (Converxity) | ✅ | HTTP POST a API externa |
|ConversionReporterService (Shopify) | ✅ | GraphQL usageRecordCreate |
|Dashboard admin | ✅ | Métricas + tabla conversiones |
|Instalación app (OAuth) | ✅ | shopify.server.ts |
|CI/CD (GitHub Actions) | ✅ | Build → Fly deploy |
|Docker + Fly.io | ✅ | Multi-stage + config |
|DB (Prisma + SQLite) | ✅ | Schema completo |
|CRUD Afiliados | ❌ | UI vacía |
|Settings editable | ❌ | Solo lectura |

---

**Diagrama BPMN:** `/Users/kevin/Downloads/diagram_shopify_appv5.bpmn`  
**Última actualización:** 2026-04-27  
**Estado:** Flujo conversión 100% funcional (pixel → db → reporte). Faltan UI de afiliados y configuración editable.

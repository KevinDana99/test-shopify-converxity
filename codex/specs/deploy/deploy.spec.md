## Deploy Spec

### Objetivo

Dejar la aplicación preparada para deploy estable en Fly.io con dos entornos separados:

- `develop`
- `main`

El objetivo es eliminar la dependencia de túneles efímeros para validar la app embebida y el endpoint de `report-payment`, dejando CI/CD básico y runtime consistente.

### Alcance

Esta implementación cubre:

1. `Dockerfile` multi-stage para build y runtime.
2. Configuración Fly separada por entorno.
3. Persistencia SQLite mediante volumen montado en Fly.
4. Variables mínimas de entorno documentadas.
5. GitHub Actions para:
   - CI de build
   - deploy automático por rama

### Entornos

#### Develop

- App Fly independiente
- Deploy automático al hacer push a `develop`
- Puede quedarse con `min_machines_running = 0`

#### Main

- App Fly independiente
- Deploy automático al hacer push a `main`
- Debe mantener al menos una máquina activa

### Runtime esperado

- La app corre en `PORT=3000`
- `NODE_ENV=production`
- `DATABASE_URL=file:/data/dev.sqlite`
- Prisma corre migraciones en startup
- El archivo SQLite persiste en un volumen Fly montado en `/data`

### Docker

El contenedor debe:

1. instalar dependencias una sola vez,
2. compilar la app en etapa de build,
3. copiar solo artefactos necesarios al runtime,
4. arrancar con migraciones + servidor Remix.

### CI

El workflow de CI debe:

1. hacer checkout,
2. instalar Bun,
3. instalar dependencias,
4. generar Prisma Client,
5. validar que la app compila.

No es objetivo en esta fase ejecutar una matriz pesada de versiones ni checks heredados del template si no agregan valor al deploy real.

### CD

El workflow de deploy debe:

- desplegar `develop` usando `fly.develop.toml`
- desplegar `main` usando `fly.main.toml`
- usar `FLY_API_TOKEN` desde GitHub Secrets

### Secrets mínimos requeridos

Cada entorno necesita, como mínimo:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SCOPES`
- `SHOPIFY_APP_URL`
- `REPORT_PAYMENT_SECRET`

Además GitHub Actions necesita:

- `FLY_API_TOKEN`

### No objetivos

Esta fase no cubre:

- PostgreSQL
- Redis/BullMQ productivo
- rollout blue/green
- monitoreo
- alerting
- tests e2e de deploy
- múltiples regiones

### Resultado esperado

Al finalizar:

- `develop` y `main` pueden desplegarse por separado en Fly,
- la app tiene una URL estable por entorno,
- el Web Pixel puede apuntar a un backend real sin depender de túneles efímeros,
- y el equipo puede iterar sobre CI/CD sin rehacer la base de runtime.

## Deploy Prompt

Implementar una base de deploy estable para la app Shopify en Fly.io con dos entornos separados (`develop` y `main`).

El cambio debe:

1. endurecer el `Dockerfile` para build/runtime reales,
2. usar `DATABASE_URL` por entorno con SQLite persistido en volumen Fly,
3. separar la configuración Fly en dos archivos,
4. agregar GitHub Actions para CI y deploy automático por rama,
5. documentar las variables mínimas necesarias en `.env.example`.

Mantener la implementación simple y product-ready para MVP.
No introducir infraestructura extra que todavía no se necesita.

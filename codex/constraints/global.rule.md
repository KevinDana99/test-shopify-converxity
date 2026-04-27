# Reglas Globales

- Conservar el flujo oficial de autenticación de Shopify Remix.
- Mantener la app embebida y usar Polaris para la UI de admin.
- Validar todos los payloads externos con Zod antes de la lógica de negocio.
- Aplicar listas permitidas explícitas de CORS para endpoints públicos de ingestión.
- Preferir SQLite para el MVP local y mantener el esquema portable a PostgreSQL más adelante.

# Reglas de Auth

- No reemplazar Shopify OAuth ni el manejo de sesión de la plantilla.
- Las rutas de admin siempre deben autenticarse mediante `authenticate.admin`.
- Las rutas públicas de ingestión deben permanecer sin autenticación y depender de validación de payload y origen.

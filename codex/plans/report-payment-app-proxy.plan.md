# Plan de Report-Payment App Proxy

1. Configurar `App Proxy` en la app Shopify para exponer una ruta same-site bajo el dominio de la tienda.
2. Crear o adaptar la route Remix que recibirá la request reenviada por `App Proxy`.
3. Cambiar `handleReportPayment` para usar la URL de `App Proxy` en vez de la URL pública directa de la app.
4. Mantener el payload actual de `report-payment` sin cambios.
5. Verificar que el backend siga aplicando validación de contrato, contexto e idempotencia.
6. Probar una compra de prueba y confirmar que el request llegue al backend sin bloqueo cross-origin.

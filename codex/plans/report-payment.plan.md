# Plan de Report-Payment

1. Extraer desde el `Web Pixel` la lógica de envío del reporte a una función dedicada llamada `reportPayment`.
2. Alinear el payload emitido por el pixel con el contrato definido en la spec de `report-payment`.
3. Definir en Remix un endpoint receptor específico para `report-payment` o adaptar el endpoint actual para respetar el nuevo contrato.
4. Validar el request con Zod antes de ejecutar lógica de negocio.
5. Validar `shopDomain`, `Origin` y `X-Shopify-Shop-Domain` cuando exista.
6. Construir la clave de idempotencia con `shopDomain + orderId + affiliateCode`.
7. Consultar Redis/BullMQ para evitar reprocesar requests duplicadas.
8. Encolar la request válida para procesamiento posterior en vez de ejecutar lógica pesada en línea.
9. Responder con el contrato semántico definido para `201 created`, `200 duplicate`, `400 invalid_payload`, `403 forbidden` y `422 affiliate_required`.
10. Verificar el flujo con una compra de prueba desde storefront y confirmar que el pixel recibe una respuesta coherente del backend.

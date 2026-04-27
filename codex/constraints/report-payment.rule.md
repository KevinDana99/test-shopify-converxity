# Reglas de Report-Payment

- La función `reportPayment` debe ejecutarse desde la extensión `Web Pixel`, no desde React ni desde App Bridge.
- El reporte solo puede enviarse cuando exista una atribución válida persistida para el visitante al momento de `checkout_completed`.
- El payload del reporte debe cumplir el contrato definido en la spec antes de enviarse al backend.
- El endpoint de `report-payment` en Remix no debe requerir `SHOPIFY_SESSION_TOKEN` ni autenticación basada en App Bridge.
- El endpoint debe tratarse como un endpoint público controlado y validar como mínimo: contrato con Zod, `shopDomain`, `Origin`, `X-Shopify-Shop-Domain` cuando exista e idempotencia.
- La clave de idempotencia debe componerse por `shopDomain + orderId + affiliateCode`.
- Si una request repite la misma clave de idempotencia, el backend debe responder como duplicado y no reprocesar la operación.
- La request válida debe encolarse en Redis/BullMQ antes del procesamiento pesado de negocio.
- Las respuestas de la API deben respetar el contrato semántico: `201 created`, `200 duplicate`, `400 invalid_payload`, `403 forbidden`, `422 affiliate_required`.
- La autenticación basada en App Bridge queda reservada para otros endpoints del admin embebido y no debe mezclarse con este flujo.

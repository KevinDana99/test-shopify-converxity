## Report Payment Redis Plan

1. Agregar infraestructura Redis/BullMQ al proyecto.

2. Implementar servicio de cola para `report-payment`.
   Debe construir la key de idempotencia y encolar el payload completo.

3. Adaptar `/api/conversions`.
   Debe dejar de procesar toda la lógica inline y pasar a responder `accepted/duplicate`.

4. Implementar worker de `report-payment`.

5. Implementar `PaymentAffiliateService`.
   Debe ejecutar cálculos y `UsageRecord` en Shopify.

6. Implementar `ConversionReportService`.
   Debe persistir conversión, billing event y reporte interno.

7. Mantener Prisma como guardrail de duplicados.

8. Configurar retries en BullMQ:
   - `attempts: 3`
   - `backoff: exponential`

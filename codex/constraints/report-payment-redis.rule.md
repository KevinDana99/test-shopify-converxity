## Report Payment Redis Rules

1. `/api/conversions` no debe ejecutar toda la lógica de negocio inline.
   Solo valida, deduplica y encola.

2. Redis es obligatorio para la idempotencia de entrada.
   La key debe ser:
   - `shopDomain:orderId:affiliateCode`

3. BullMQ es obligatorio para la cola de `report-payment`.

4. El payload del job debe ser completo.
   No usar una referencia mínima que obligue a reconstruir estado después.

5. `PaymentAffiliateService` es el primer consumidor del job.
   Si falla, BullMQ debe reintentar.

6. `ConversionReportService` solo corre después de éxito en `PaymentAffiliateService`.

7. Prisma debe conservar constraints de unicidad como red de seguridad final.
   Redis no reemplaza la integridad final de base de datos.

8. Configuración inicial de retries:
   - `attempts: 3`
   - `backoff: exponential`

9. Cuando se agotan retries, el job debe quedar `failed`.

10. La implementación debe mantenerse simple.
   No introducir observabilidad, dashboards o colas múltiples si no son necesarias para esta fase.

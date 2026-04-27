## Redis Spec

### Objetivo

Implementar procesamiento asíncrono de `report-payment` con `Redis` y `BullMQ` para que `/api/conversions` deje de procesar toda la lógica inline.

### Alcance

1. `Redis` como infraestructura de idempotencia y cola.
2. `BullMQ` para encolar jobs de `report-payment`.
3. El endpoint `/api/conversions`:
   - valida contrato,
   - valida request,
   - deduplica,
   - encola,
   - y responde rápido.
4. Un worker consume la cola y procesa la lógica de negocio.

### Idempotencia

- La key de idempotencia será:
  - `shopDomain:orderId:affiliateCode`

- Redis debe verificar si la key ya existe antes de encolar.
- Si la key ya existe:
  - responder `200 duplicate`
- Si la key no existe:
  - persistir la key en Redis
  - encolar el job
  - responder `202 accepted`

- Prisma debe seguir manteniendo unicidad como red de seguridad final.

### Payload del job

- El payload enviado a BullMQ debe ser el payload completo de `report-payment`.
- No se enviará solo una referencia mínima.

### Flujo

1. Cliente / Web Pixel envía `report-payment`
2. `/api/conversions` valida y deduplica
3. Redis/BullMQ encola el job
4. `PaymentAffiliateService` consume el job
5. `PaymentAffiliateService`:
   - calcula fee de Converxity
   - calcula comisión del afiliado
   - genera `UsageRecord` en Shopify vía GraphQL
6. Si `PaymentAffiliateService` termina bien:
   - continúa hacia `ConversionReportService`
7. `ConversionReportService`:
   - persiste conversión
   - persiste billing event
   - reporta a Converxity

### Retries

- BullMQ debe reintentar cuando falle `PaymentAffiliateService`
- Configuración inicial:
  - `attempts: 3`
  - `backoff: exponential`

### Error final

- Si se agotan los reintentos:
  - el job queda en estado `failed`
  - no se considera procesado exitosamente

### No objetivos

- Redis cluster avanzado
- observabilidad avanzada
- panel de reintentos manuales
- múltiples colas por tipo de evento
- tuning de throughput para picos extremos

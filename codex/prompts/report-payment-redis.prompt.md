## Report Payment Redis Prompt

Refactorizar `report-payment` para usar `Redis` + `BullMQ`.

El endpoint `/api/conversions` debe:

1. validar el request,
2. construir la key `shopDomain:orderId:affiliateCode`,
3. verificar duplicados en Redis,
4. responder `200 duplicate` si ya existe,
5. encolar el payload completo si no existe,
6. responder `202 accepted`.

El worker debe consumir la cola y ejecutar:

1. `PaymentAffiliateService`
   - calcular fee de Converxity
   - calcular comisión del afiliado
   - crear `UsageRecord` en Shopify vía GraphQL

2. `ConversionReportService`
   - persistir conversión
   - persistir billing event
   - reportar a Converxity

BullMQ debe usar:
- `attempts: 3`
- `backoff: exponential`

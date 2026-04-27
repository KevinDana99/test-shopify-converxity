## Report-Payment App Proxy Spec

## Objetivo

Reemplazar el envío directo desde `Web Pixel` hacia la URL pública de la app por un flujo de `App Proxy` de Shopify, de forma que el storefront reporte la conversión mediante una ruta same-site de la tienda y Shopify reenvíe la request al backend Remix.

## Motivación

- El flujo actual `storefront -> trycloudflare app URL` introduce problemas de CORS y transporte en desarrollo.
- El `Web Pixel` ya valida el evento, la atribución y el payload; el cuello actual es la entrega cross-origin hacia la app.
- `App Proxy` permite usar una URL del dominio de la tienda y reducir problemas de cross-origin para el reporte.

## Emisor del reporte

- La función `handleReportPayment` debe seguir ejecutándose dentro del `Web Pixel`.
- La diferencia es que ya no debe enviar la request a la URL pública directa de la app.
- Debe enviar la request a una ruta de `App Proxy` bajo el dominio de la tienda.

## Request

El payload del reporte no cambia:

```json
{
  "orderId": "7339743805501",
  "subtotalAmount": 699.95,
  "affiliateCode": "ADR",
  "currencyCode": "USD",
  "customerId": "9145258344509",
  "happenedAt": "2026-04-27T03:18:15.336Z",
  "orderName": null,
  "shopDomain": "test-converxity-store.myshopify.com",
  "sourceUrl": "https://test-converxity-store.myshopify.com/?ref=Adr"
}
```

## Transporte

- El `Web Pixel` debe resolver una URL de `App Proxy` same-site.
- Shopify debe reenviar esa request al backend Remix.
- El endpoint receptor en Remix debe conservar el mismo contrato semántico de `report-payment`.

## Response 201

```json
{
  "status": "created",
  "orderId": "7339743805501",
  "customerId": "9145258344509",
  "createdAt": "2026-04-27T03:18:15.336Z"
}
```

## Response 200

```json
{
  "status": "duplicate",
  "orderId": "7339743805501",
  "customerId": "9145258344509",
  "createdAt": "2026-04-27T03:18:15.336Z"
}
```

## Reglas

1. El cambio a `App Proxy` no debe modificar el contrato del payload de `report-payment`.
2. La lógica de atribución en `page_viewed` y la lectura en `checkout_completed` no deben cambiar.
3. El backend debe seguir validando contrato, `shopDomain`, contexto relevante e idempotencia.
4. La clave de idempotencia debe seguir siendo `shopDomain + orderId + affiliateCode`.
5. El uso de `App Proxy` reemplaza el transporte cross-origin directo y busca evitar dependencias de CORS inestable en desarrollo.

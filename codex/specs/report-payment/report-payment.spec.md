## Report-Payment Spec

## Objetivo

Crear una función dentro del `Web Pixel` que tome los datos del evento `checkout_completed`, arme el reporte de compra atribuida y lo envíe mediante `fetch` a una API construida en Remix.

## Emisor del reporte

- El reporte debe salir desde la extensión `Web Pixel`.
- No debe implementarse como hook de React ni depender del frontend embebido del admin.
- La función debe ejecutarse únicamente después de que el pixel haya leído una atribución válida persistida para el visitante.

## Request

El reporte debe estructurar los datos de la siguiente manera:

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

## Response 400

```json
{
  "error": "invalid_payload",
  "message": "La solicitud no cumple el contrato esperado."
}
```

## Response 403

```json
{
  "error": "forbidden",
  "message": "El acceso a esta API está prohibido para este origen o tienda."
}
```

## Response 422

```json
{
  "error": "affiliate_required",
  "message": "La conversión requiere un afiliado válido para ser procesada."
}
```

## Reglas

1. La función del pixel debe enviar el reporte mediante `fetch` a la API construida en Remix.
2. Por ahora la integración puede mockear la respuesta del backend hasta cerrar la implementación definitiva, pero este es el contrato formal.
3. La API debe responder con el contrato establecido según el resultado del procesamiento.
4. La request debe salir del contexto del `Web Pixel`, no del App Bridge ni del admin embebido.
5. Este endpoint no debe requerir `SHOPIFY_SESSION_TOKEN` ni autenticación basada en App Bridge, porque no se ejecuta desde el admin embebido.
6. La validación de acceso debe resolverse del lado del servidor Remix como endpoint público controlado, validando `shopDomain`, origen permitido, headers relevantes y reglas de idempotencia.
7. La autenticación basada en App Bridge queda reservada para el resto de endpoints del admin embebido y no forma parte de este flujo de `report-payment`.

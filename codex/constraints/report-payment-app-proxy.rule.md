# Reglas de Report-Payment App Proxy

- La función `handleReportPayment` debe seguir ejecutándose desde la extensión `Web Pixel`.
- El payload de `report-payment` no debe cambiar por introducir `App Proxy`.
- La URL destino del reporte debe ser same-site bajo el dominio de la tienda y servirse mediante `App Proxy`.
- El flujo de `App Proxy` debe reemplazar el transporte directo hacia la URL pública de la app en desarrollo.
- La validación del backend en Remix debe mantenerse: contrato con Zod, `shopDomain`, contexto relevante e idempotencia.
- La clave de idempotencia debe seguir siendo `shopDomain + orderId + affiliateCode`.
- El cambio de transporte no debe alterar la lógica ya validada de `page_viewed`, persistencia de atribución y `checkout_completed`.

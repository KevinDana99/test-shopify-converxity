# Prompt de Report-Payment App Proxy

Reemplazar el transporte directo de `report-payment` desde `Web Pixel` hacia la URL pública de la app por una ruta `App Proxy` same-site bajo el dominio de la tienda. Mantener intacto el payload del reporte, la lógica de atribución validada en el pixel y el contrato semántico del backend. El objetivo es eliminar el cuello cross-origin del flujo `storefront -> trycloudflare app URL` y hacer que Shopify reenvíe la request al backend Remix mediante `App Proxy`.

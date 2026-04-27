# Reglas de Web Pixel

- La extensión debe ser de tipo `Web Pixel` dentro de la misma app de Shopify; no debe resolverse con ScriptTags legacy.
- El pixel debe escuchar `page_viewed` para capturar la atribución inicial del visitante y `checkout_completed` para reportar conversiones.
- El query param canónico de atribución es `?ref=CODE`; no deben introducirse parámetros alternativos en esta versión.
- La atribución del visitante debe persistirse en `localStorage`, no en cookies ni en `sessionStorage`.
- La atribución debe seguir una regla `last touch`: un nuevo código válido reemplaza la atribución persistida anterior.
- La ventana de atribución del visitante debe ser de 7 días; cuando entra un nuevo código válido, la ventana debe reiniciarse.
- Este flujo no crea afiliados nuevos; solo consume códigos de afiliado ya existentes en la tienda.
- La validación final del código de afiliado corresponde al backend contra la tabla `Affiliate`.
- Si el código de afiliado no es válido, el flujo de compra del cliente no debe interrumpirse.
- La instrumentación inicial de verificación puede usar `console.log` dentro del pixel para confirmar captura, persistencia y lectura de la atribución.

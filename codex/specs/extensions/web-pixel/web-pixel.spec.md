## Spec de Web Pixel

## Objetivo

Integrar una extensión de tipo Web Pixel en la app de Shopify para capturar la atribución inicial de un visitante hacia un afiliado en storefront y reportar conversiones al backend cuando ocurra `checkout_completed`.

## Alcance

- Añadir la integración de Web Pixel a la app.
- Asegurar que el pixel quede correctamente instalado y que pueda escuchar eventos estándar de Shopify.
- Capturar el código de afiliado desde la URL durante la navegación del visitante.
- Persistir la atribución del visitante hacia un afiliado del lado del cliente hasta que ocurra la compra.
- Enviar un reporte de conversión al backend al completarse la compra.

## Atribución en Storefront

### Entrada del código de afiliado

- El código de afiliado entra mediante el query param canónico `?ref=CODE`.

### Persistencia de la atribución

- La atribución del visitante debe persistirse en `localStorage`.
- Debe almacenarse al menos el `affiliateCode`.
- La atribución sigue una regla `last touch`.
- Si un visitante entra con un nuevo `?ref=CODE`, el valor persistido debe sobrescribirse por el último código válido detectado.

### Ventana de atribución

- La atribución del visitante hacia un afiliado permanece vigente por 7 días.
- Si antes de ese plazo entra un nuevo código válido, la atribución previa debe reemplazarse y la ventana de 7 días debe reiniciarse.

## Conversión

### Evento de conversión

- Una conversión se considera válida cuando el Web Pixel recibe el evento estándar `checkout_completed`.

### Comportamiento del pixel

- El pixel debe escuchar `page_viewed` para capturar o actualizar la atribución del visitante hacia un afiliado.
- El pixel debe escuchar `checkout_completed` para enviar la conversión.

### Payload hacia backend

- Al ocurrir `checkout_completed`, el pixel debe leer la atribución persistida en `localStorage`.
- Si existe una atribución válida, el pixel debe enviar un reporte detallado de la compra al backend de la app.
- El contrato exacto del payload se definirá en la implementación backend de conversión.

## Reglas de negocio

- Si el visitante entra con `?ref=ANA` y luego con `?ref=LUIS`, la conversión debe atribuirse a `LUIS`.
- La sobrescritura aplica solo a la atribución persistida del visitante, no a la identidad de afiliados en base de datos.
- El código de afiliado debe ser único dentro de cada tienda.
- El mismo código puede existir en otra tienda distinta, porque los afiliados no comparten identidad entre tiendas.
- Este flujo no crea afiliados nuevos; solo utiliza códigos de afiliado ya existentes en la tienda.

## Afiliado inválido

- Si el código recibido no corresponde a un afiliado válido, la compra no debe interrumpirse.
- El cliente debe poder continuar su proceso de compra normalmente.
- La validación final del código de afiliado corresponde al flujo de backend.

## Distribución de responsabilidades

- `storefront / pixel`: capturar, conservar y recuperar la atribución del visitante hacia un código de afiliado.
- `backend`: validar, persistir y procesar la conversión reportada.

## No objetivos

- Multi-touch attribution.
- Split commissions.
- Devoluciones.
- Cross-device attribution.
- Payouts automáticos.

# Plan de Web Pixel

1. Generar una extensión de tipo `Web Pixel` dentro de la app y dejarla registrada en `extensions/`.
2. Implementar la suscripción del pixel al evento `page_viewed`.
3. Leer el query param canónico `?ref=CODE` desde el contexto disponible del pixel.
4. Persistir la atribución del visitante en `localStorage` bajo una regla `last touch`.
5. Guardar junto con la atribución la información necesaria para validar la ventana de 7 días.
6. Implementar la suscripción del pixel al evento `checkout_completed`.
7. Recuperar la atribución persistida al momento de `checkout_completed`.
8. Agregar `console.log` de verificación para confirmar captura, persistencia y lectura de la atribución.
9. Probar el flujo entrando al storefront con `?ref=CODE` y validar que el valor quede persistido correctamente.
10. Dejar preparado el punto de integración para que el pixel envíe la conversión al backend en la siguiente fase.

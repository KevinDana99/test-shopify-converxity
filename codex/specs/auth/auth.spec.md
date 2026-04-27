# Spec de Auth

## Objetivo

Reutilizar el stack oficial de autenticación de Shopify Remix sin reemplazarlo.

## Reglas

- `authenticate.admin` para rutas embebidas
- `authenticate.webhook` para webhooks
- El endpoint público de conversiones permanece fuera de la autenticación del admin

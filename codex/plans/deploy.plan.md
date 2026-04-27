## Deploy Plan

1. Revisar la configuración actual de runtime.
   Validar `Dockerfile`, `package.json`, Prisma y Fly.

2. Preparar el contenedor para producción.
   Usar build multi-stage y runtime liviano.

3. Mover la base de datos a una ruta persistente en Fly.
   Configurar `DATABASE_URL=file:/data/dev.sqlite`.

4. Separar Fly por entorno.
   Crear `fly.develop.toml` y `fly.main.toml`.

5. Agregar CI mínimo.
   Instalar Bun, generar Prisma Client y compilar la app.

6. Agregar CD por rama.
   Desplegar `develop` y `main` con sus configs Fly correspondientes.

7. Documentar variables mínimas.
   Actualizar `.env.example` con runtime y secrets base.

8. Dejar checklist manual pendiente.
   Crear apps Fly, volúmenes, secrets y token de GitHub Actions.

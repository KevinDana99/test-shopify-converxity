## Deploy Rules

1. La app debe mantenerse sobre el template oficial de Shopify Remix.
   No reimplementar auth ni inventar un servidor paralelo solo para deploy.

2. El deploy debe separar `develop` y `main`.
   Cada rama debe tener su propia app Fly y su propia URL estable.

3. El runtime debe seguir siendo simple.
   En esta fase se usa SQLite con volumen montado en Fly.

4. La base de datos debe persistir fuera del filesystem efímero del contenedor.
   `DATABASE_URL` debe apuntar a `/data/dev.sqlite`.

5. El contenedor debe compilar una sola vez y arrancar liviano.
   No regenerar dependencias completas en cada boot.

6. El startup del contenedor puede correr migraciones Prisma.
   No debe depender de pasos manuales de DB en cada release.

7. CI debe validar build real con Bun.
   No arrastrar workflows ruidosos del template si no sirven al flujo actual.

8. CD debe dispararse por rama:
   - `develop` -> entorno Fly develop
   - `main` -> entorno Fly main

9. Los secretos no deben quedar hardcodeados en el repo.
   Deben vivir en Fly Secrets y GitHub Secrets.

10. El despliegue debe preparar el terreno para el Web Pixel.
   La app necesita URL estable por entorno para dejar atrás túneles efímeros.

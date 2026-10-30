# Plataforma de Trazabilidad Agroindustrial (cardamomo)

Proyecto A – Proyecto Final Desarrollo Web, UMG.

- `api/`: backend NestJS + Prisma (REST, `/api/v1`, Swagger en `/api/docs`).
- `web/`: aplicación web de administración (React + Vite).
- `pwa/`: PWA instalable para personal de campo (React + Vite + Dexie).
- `deploy/`: configuración de producción (Docker Compose + Caddy).
- `.github/workflows/ci-cd.yml`: pipeline de pruebas, build, push a ghcr.io y deploy.

## Ejecución local (desarrollo)

Requisitos: Docker Desktop y Node.js 22.

```bash
cp .env.example .env          # y completa los valores
docker compose up --build     # levanta db, api, web y pwa
```
API: http://localhost:3000/api/v1/health

Swagger: http://localhost:3000/api/docs

Web: http://localhost:8081

PWA: http://localhost:8082

Sin Docker (solo API):

Bash
cd api
npm install
npx prisma generate
npm run start:dev

Reglas del equipo
Ramas feat/<tema> y Pull Request a main. Cada merge a main se despliega.

No subir secretos ni .env.

Cambios a api/prisma/schema.prisma se avisan al equipo antes del merge.

Antes de subir el primer commit de cada carpeta, ejecuta npm install y sube package-lock.json (el pipeline usa npm ci).

Pendiente antes de la entrega
[ ] Iconos de la PWA: pwa/public/icon-192.png, pwa/public/icon-512.png y maskable.

[ ] Migraciones de Prisma: npx prisma migrate dev --name init dentro de api/.

[ ] Secretos de GitHub Actions: SSH_HOST, SSH_USER, SSH_PRIVATE_KEY.

[ ] Servidor de producción con el repo clonado en /opt/trazabilidad y .env propio.

Variables de Entorno (Ejemplo)

# Base de Datos
DATABASE_URL="postgresql://usuario:password@localhost:5432/trazabilidad"

# Autenticación
JWT_SECRET="clave_secreta_aqui"
JWT_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Almacenamiento S3
S3_ENDPOINT="[[PENDIENTE: URL S3]]"
S3_ACCESS_KEY="[[PENDIENTE: Access Key]]"
S3_SECRET_KEY="[[PENDIENTE: Secret Key]]"
S3_BUCKET="trazabilidad-archivos"
Despliegue y URLs de Producción
El proyecto cuenta con integración y despliegue continuo (CI/CD) mediante GitHub Actions. Cada cambio integrado en la rama main construye automáticamente las imágenes en ghcr.io y actualiza el servidor en DigitalOcean.

Aplicación Web (Admin): [[PENDIENTE: URL Web]]

Aplicación PWA (Campo): [[PENDIENTE: URL PWA]]

Documentación API (Swagger): [[PENDIENTE: URL Swagger]]

Usuarios DemoPara evaluar la plataforma, puedes utilizar las siguientes credenciales de prueba según el rol deseado:RolCorreo ElectrónicoContraseñaAdministrador[[PENDIENTE: Correo Admin]][[PENDIENTE: Pass Admin]]Supervisor[[PENDIENTE: Correo Supervisor]][[PENDIENTE: Pass Supervisor]]Calidad[[PENDIENTE: Correo Calidad]][[PENDIENTE: Pass Calidad]]Báscula/Bodega[[PENDIENTE: Correo Báscula]][[PENDIENTE: Pass Báscula]]Campo (PWA)[[PENDIENTE: Correo Campo]][[PENDIENTE: Pass Campo]]Auditor[[PENDIENTE: Correo Auditor]][[PENDIENTE: Pass Auditor]]

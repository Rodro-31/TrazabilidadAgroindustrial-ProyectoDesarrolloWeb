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

- API: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/docs
- Web: http://localhost:8081
- PWA: http://localhost:8082

Sin Docker (solo API):

```bash
cd api
npm install
npx prisma generate
npm run start:dev
```

## Reglas del equipo

- Ramas `feat/<tema>` y Pull Request a `main`. Cada merge a `main` se despliega.
- No subir secretos ni `.env`.
- Cambios a `api/prisma/schema.prisma` se avisan al equipo antes del merge.
- Antes de subir el primer commit de cada carpeta, ejecuta `npm install` y sube `package-lock.json` (el pipeline usa `npm ci`).

## Pendiente antes de la entrega

- [ ] Iconos de la PWA: `pwa/public/icon-192.png`, `pwa/public/icon-512.png` y maskable.
- [ ] Migraciones de Prisma: `npx prisma migrate dev --name init` dentro de `api/`.
- [ ] Secretos de GitHub Actions: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`.
- [ ] Servidor de producción con el repo clonado en `/opt/trazabilidad` y `.env` propio.

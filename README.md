# Plataforma de Trazabilidad Agroindustrial (cardamomo)

Proyecto A – Proyecto Final Desarrollo Web, UMG.

Plataforma de trazabilidad de cardamomo: los productores entregan producto en centros de acopio; cada entrega se pesa, se clasifica y se asocia a un lote; los lotes se mezclan, dividen, trasladan y procesan, y el sistema responde de dónde vino un lote, qué controles de calidad tuvo y qué movimientos registró. Incluye una **aplicación web** (administración, calidad, báscula) y una **PWA instalable** para el personal de campo.

## Estructura del repositorio

| Carpeta / archivo | Contenido |
|---|---|
| `api/` | Backend NestJS + Prisma (REST en `/api/v1`, Swagger en `/api/docs`) |
| `web/` | Aplicación web de administración (React + Vite) |
| `pwa/` | PWA instalable para personal de campo (React + Vite + Dexie/IndexedDB) |
| `deploy/` | Configuración de producción (Docker Compose + Caddy) |
| `docs/` | Documentación técnica, funcional, plan de pruebas y evidencias |
| `.github/workflows/ci-cd.yml` | Pipeline de pruebas, build, push a `ghcr.io` y despliegue |

## Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | NestJS (Node.js + TypeScript), arquitectura de monolito modular |
| ORM y base de datos | Prisma + PostgreSQL 16 |
| Frontend | React + Vite (dos aplicaciones: `web` y `pwa`) |
| PWA | Service worker + IndexedDB (Dexie) para trabajo sin conexión |
| Autenticación | Propia: bcrypt, JWT de 15 minutos y refresh token de 7 días |
| Archivos | Disco local del servidor, en un volumen Docker persistente (`uploads`) |
| Contenedores | Docker + Docker Compose |
| Registry | GitHub Container Registry (`ghcr.io`) |
| CI/CD | GitHub Actions |
| Nube y HTTPS | DigitalOcean (Droplet) + Caddy con Let's Encrypt |

## Ejecución local (desarrollo)

Requisitos: Docker Desktop y Node.js 22.

```bash
cp .env.example .env          # y completa los valores
docker compose up --build     # levanta db, api, web y pwa
```

| Servicio | URL local |
|---|---|
| API (health) | http://localhost:3000/api/v1/health |
| Swagger | http://localhost:3000/api/docs |
| Web | http://localhost:8081 |
| PWA | http://localhost:8082 |

Solo la API, sin Docker:

```bash
cd api
npm install
npx prisma generate
npm run start:dev
```

Pruebas automatizadas del backend: `cd api && npm test`.

## Variables de entorno

Se definen en `.env` (copia de `.env.example`). **Nunca se sube `.env` al repositorio.**

| Variable | Uso |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciales de PostgreSQL |
| `DATABASE_URL` | Conexión de la API a la base (solo si corre fuera de Docker) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Firma de los tokens de sesión |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Correo de recuperación de contraseña (opcional; sin `SMTP_HOST` el administrador genera el enlace desde la pantalla Usuarios) |
| `PORT`, `APP_URL`, `PWA_URL`, `CORS_ORIGINS` | Puerto, URLs de las apps y orígenes permitidos |
| `DOMINIO` | Solo producción: dominio base que usa Caddy |
| `S3_*` | Presentes en `.env.example`, pero la versión actual **no las utiliza**: las fotos se guardan en disco local |

## Despliegue y URLs de producción

Cada cambio integrado en `main` ejecuta el pipeline: pruebas → construcción de imágenes → publicación en `ghcr.io` → despliegue por SSH en el Droplet de DigitalOcean, donde Docker Compose actualiza los contenedores y aplica las migraciones de Prisma. Detalle en [`docs/cicd.md`](docs/cicd.md).

| Sitio | URL |
|---|---|
| Aplicación web (administración) | https://app.x-dev.store |
| PWA de campo | https://campo.x-dev.store |
| API | https://api.x-dev.store/api/v1 |
| Documentación de la API (Swagger) | https://api.x-dev.store/api/docs |

## Usuarios demo

Un usuario por rol, todos con el dominio `demo.x-dev.store`. La contraseña de prueba se entrega por separado al docente y no se publica en el repositorio.

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@demo.x-dev.store` | Entregada por separado |
| Supervisor | `supervisor@demo.x-dev.store` | Entregada por separado |
| Calidad | `calidad@demo.x-dev.store` | Entregada por separado |
| Báscula/Bodega | `bascula@demo.x-dev.store` | Entregada por separado |
| Campo (PWA) | `campo@demo.x-dev.store` | Entregada por separado |
| Auditor | `auditor@demo.x-dev.store` | Entregada por separado |

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/arquitectura.md`](docs/arquitectura.md) | Diagrama de arquitectura y justificación técnica |
| [`docs/modelo-datos.md`](docs/modelo-datos.md) | Diagrama entidad-relación |
| [`docs/seguridad.md`](docs/seguridad.md) | Autenticación, roles, tokens y auditoría |
| [`docs/cicd.md`](docs/cicd.md) | Pipeline y despliegue |
| [`docs/manual-web.md`](docs/manual-web.md) | Manual de la aplicación web por rol |
| [`docs/manual-pwa.md`](docs/manual-pwa.md) | Manual de la PWA |
| [`docs/plan-pruebas.md`](docs/plan-pruebas.md) | Plan de pruebas funcionales |
| [`docs/evidencias/`](docs/evidencias/README.md) | Capturas de la versión en producción |
| [`docs/guion-defensa.md`](docs/guion-defensa.md) | Guion de la defensa |

## Reglas del equipo

- Ramas `feat/<tema>` y Pull Request a `main`. Cada merge a `main` se despliega.
- No subir secretos ni `.env`.
- Los cambios a `api/prisma/schema.prisma` se avisan al equipo antes del merge.
- Antes de subir el primer commit de cada carpeta, ejecutar `npm install` y subir `package-lock.json` (el pipeline usa `npm ci`).

## Secretos de GitHub Actions

`SSH_HOST`, `SSH_USER` y `SSH_PRIVATE_KEY` (acceso al Droplet; ver `docs/cicd.md`).

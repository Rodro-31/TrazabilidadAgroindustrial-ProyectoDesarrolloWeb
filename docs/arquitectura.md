# Arquitectura del Sistema

La plataforma sigue una arquitectura cliente-servidor con despliegue en contenedores, optimizada para la nube y trabajo de campo agroindustrial.

## Componentes Principales

- **Backend (API REST):** Desarrollado en NestJS con TypeScript. Expone endpoints bajo `/api/v1` y documentación Swagger en `/api/docs`.
- **Frontend (Admin Web):** SPA en React + Vite para la gestión administrativa desde navegadores de escritorio.
- **Frontend (PWA Campo):** Aplicación web progresiva (React + Vite + Dexie.js) diseñada para operar offline o con baja conectividad durante el pesaje y recepción en fincas.
- **Base de Datos:** PostgreSQL para persistencia relacional, gestionada a través del ORM Prisma.
- **Almacenamiento (S3):** Repositorio de objetos para guardar evidencias documentales.

## Infraestructura y Despliegue (CI/CD)

- **Contenedores:** Todo el entorno (API, Web, PWA, Base de datos) se orquesta con Docker y Docker Compose.
- **Proxy Inverso:** Caddy se encarga del enrutamiento web y la gestión automática de certificados SSL.
- **Pipeline (GitHub Actions):** Automatiza las pruebas, la construcción de imágenes en `ghcr.io` y el despliegue continuo hacia el servidor de producción.

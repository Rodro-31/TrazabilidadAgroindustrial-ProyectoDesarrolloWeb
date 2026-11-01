# Web de administración

React + Vite. Base: login, rutas protegidas por rol, menú lateral, cliente de la API y
una tabla paginada reutilizable. Pantalla lista: **Auditoría**.

## Desarrollo local
```
cd web
npm install
npm run dev        # http://localhost:5174  (la API en http://localhost:3000)
```
La URL de la API se deduce sola: en `app.<dominio>` usa `api.<dominio>`; en cualquier otro
sitio usa `http://localhost:3000`. Se puede forzar con `VITE_API_URL`.
En local, la API debe permitir el origen: agrega `http://localhost:5174` a `CORS_ORIGINS`.

## Cómo agregar una pantalla (3 pasos)
1. Crear el componente en `src/pantallas/MiPantalla.tsx`.
   - Para una lista paginada: `usePaginado<Fila>('/ruta', filtros)` + `<Tabla ... />`.
   - Para otras llamadas: `api.get<T>('/ruta')` y `api.post<T>('/ruta', cuerpo)` (de `src/api.ts`).
     Los errores llegan como `ApiError` con `status` y `message` (en español).
2. Registrarla en `src/modulos.tsx` con su ruta, título y los roles que la ven.
3. Listo: el menú, la ruta y la protección por rol salen de esa lista.

Los roles del menú son solo comodidad: el permiso real lo valida la API.

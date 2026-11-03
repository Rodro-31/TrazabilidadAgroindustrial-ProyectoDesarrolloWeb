# Evidencias — Plataforma de Trazabilidad Agroindustrial (cardamomo)

Capturas de la versión final en producción (2 de noviembre de 2026).

| Sitio | URL |
|---|---|
| Panel web | https://app.x-dev.store |
| PWA de campo | https://campo.x-dev.store |
| API | https://api.x-dev.store/api/v1 |
| Documentación de la API (Swagger) | https://api.x-dev.store/api/docs |

Usuarios de demostración: `admin@`, `supervisor@`, `calidad@`, `bascula@`, `campo@` y `auditor@` (dominio `demo.x-dev.store`). La contraseña se entrega aparte.

---

## A. Infraestructura, despliegue y CI/CD

| # | Captura | Qué demuestra |
|---|---|---|
| 01 | ![HTTPS](01-https-candado.png) | El panel se sirve por **HTTPS** con certificado válido (Caddy + Let's Encrypt). |
| 02 | ![Health](02-health.png) | La API en producción responde `GET /api/v1/health` con `{"estado":"ok"}`. |
| 03 | ![Swagger](03-swagger.png) | Documentación automática de la API con **Swagger/OpenAPI**: cada endpoint tiene su descripción (qué hace, qué roles lo usan y sus reglas principales). |
| 04 | ![Pipeline](04-actions-pipeline.png) | **Pipeline CI/CD** en GitHub Actions: `test → build-push → deploy`, en verde, disparado por el merge a `main`. |
| 05 | ![Pruebas](05-actions-tests.png) | Las **pruebas automatizadas** corren en el pipeline: 11 suites, **86 pruebas** aprobadas. Si fallan, no se construye ni se despliega. |
| 06 | ![Registry](06-registry-packages.png) | **Registry de contenedores** (GitHub Container Registry): imágenes `trazabilidad-api`, `trazabilidad-web` y `trazabilidad-pwa`. |
| 07 | ![docker ps](07-servidor-docker-ps.png) | Servidor de producción (DigitalOcean): los 5 contenedores en ejecución (api, web, pwa, caddy, db) con Docker Compose. |
| 08 | ![Logs](08-servidor-logs.png) | **Logs** de la API en producción (`docker logs trazabilidad-api-1`): arranque correcto y rutas registradas (calidad, procesos, dashboard, traslados, liquidaciones, precios). |

## B. PWA de campo — usuario CAMPO

| # | Captura | Qué demuestra |
|---|---|---|
| 09 | ![Instalada](09-pwa-instalada.png) | La **PWA instalada** en el teléfono como una app más (ícono "Trazabilidad"). |
| 10 | ![Login](10-pwa-login.png) | Login de la app de campo, con el enlace **"¿Olvidaste tu contraseña?"**. |
| 11 | ![Inicio](11-pwa-inicio.png) | Menú principal: nueva recepción, escanear QR, tareas pendientes, productores y entregas, mis envíos. Indicador **"En línea"**. |
| 12 | ![Nueva recepción](12-pwa-nueva-recepcion.png) | Captura de una recepción: centro, productor (con búsqueda), finca, estado del producto, peso bruto, tara y **peso neto calculado**. |
| 12b | ![Foto](12b-pwa-nueva-recepcion-foto.png) | **Foto** tomada con la cámara del teléfono; se comprime antes de enviarse. |
| 13 | ![Comprobante QR](13-pwa-comprobante-qr.png) | Comprobante de la recepción con su **QR** (solo contiene una URL con un valor aleatorio). |
| 14 | ![Offline](14-pwa-offline-pendiente.png) | **Modo sin conexión** (modo avión): la recepción y su foto quedan **"Por enviar"** en la cola del teléfono. |
| 15 | ![Sincronizada](15-pwa-offline-enviada.png) | Al volver la conexión la cola **se envió sola**: la recepción capturada en modo avión (497 kg) ya está en el servidor **con su foto**. |
| 16 | ![Detalle](16-pwa-detalle-recepcion.png) | Detalle de la recepción ya en el servidor: datos, **foto**, inspecciones e historial de pesajes. |
| 17 | ![Productor](17-pwa-productor.png) | **Productor y entregas recientes**: organización, ubicación, fincas y sus últimas entregas (incluida la que se capturó sin conexión). |

## C. PWA — usuario CALIDAD (tareas e inspección)

| # | Captura | Qué demuestra |
|---|---|---|
| 18 | ![Tareas](18-pwa-tareas.png) | **Tareas pendientes**: cada recepción nueva genera automáticamente una tarea de inspección para el rol CALIDAD (aquí las de 695 kg y 497 kg). |
| 19 | ![Formulario](19-pwa-inspeccion-form.png) | **Inspección de calidad** desde el teléfono: resultado, grado, humedad, impurezas y defectos. Funciona sin conexión (se guarda en la cola con su propio UUID). |
| 20 | ![Inspección guardada](20-pwa-inspeccion-guardada.png) | La inspección queda registrada en la recepción: **Aprobada · grado PRIMERA**, con sus mediciones, fecha e inspector. |
| 21 | ![Tarea cerrada](21-pwa-tarea-cerrada.png) | Al registrar la inspección, **la tarea se cierra sola**: solo queda pendiente la de la otra recepción. |

## D. Panel web — usuario ADMIN

| # | Captura | Qué demuestra |
|---|---|---|
| 22 | ![Dashboard](22-web-dashboard.png) | **Dashboard con datos reales**: existencia total, lotes activos, recepciones del día, procesos y merma, kg recibidos por día, existencia por centro y por producto, lotes por estado, últimas recepciones y lotes. |
| 23 | ![Recepciones](23-web-recepciones-lista.png) | Lista de recepciones con **filtros** (centro, productor, producto, fechas), paginación y **Exportar a Excel**. Incluye las capturadas desde la PWA. |
| 24 | ![Pesaje](24-web-recepcion-pesaje.png) | **Nuevo pesaje** desde la web: el pesaje anterior no se borra, queda en el historial con su motivo y quién lo registró; el peso vigente se actualiza. También se ve la foto subida desde el teléfono. |
| 25 | ![Lote](25-web-lote-nuevo.png) | **Lote creado a partir de recepciones**, con su etiqueta **QR**, origen (recepciones y kg aportados), existencia por centro y movimientos de inventario. |
| 26 | ![Escanear lote](26-pwa-escanear-lote.png) | Desde el teléfono, al **escanear el QR del lote** la PWA abre su detalle: estado, existencia, dónde está y recepciones de origen. |
| 27 | ![Calidad web](27-web-calidad.png) | **Control de calidad en el panel web**: inspección de un lote con resultado, grado y mediciones. Si se asigna grado, pasa a ser el grado del lote. |
| 27b | ![Calidad lista](27b-web-calidad-lista.png) | Lista de inspecciones (de recepciones y de lotes, desde la PWA y desde la web) con filtro por resultado y **Exportar a Excel**. |
| 28 | ![Trazabilidad](28-web-trazabilidad.png) | **Trazabilidad del lote**: hacia atrás (productores, fincas y kg aportados) y hacia adelante (lotes derivados y ventas), con certificado PDF. |
| 28b | ![Trazabilidad derivado](28b-web-trazabilidad-derivado.png) | Trazabilidad de un **lote derivado** (L-2026-00003): viene de L-2026-00001 por **división** y, a través de él, de los productores y fincas originales (consulta recursiva). |
| 29 | ![Procesos](29-web-procesos.png) | **Proceso de división** (PR-2026-0001): el lote de entrada pasa a *Agotado* y nacen los lotes hijo con su propia etiqueta QR. |
| 30 | ![Excel](30-web-exportar-excel.png) | El archivo exportado desde Recepciones abierto en **Excel** (acentos y ñ correctos). |

## E. Seguridad

| # | Captura | Qué demuestra |
|---|---|---|
| 31 | ![Usuarios](31-web-usuarios-centros.png) | **Gestión de usuarios** (solo ADMIN): roles, centros de acopio asignados y estado. |
| 32 | ![Generar enlace](32-web-generar-enlace.png) | **Recuperación de contraseña**: el administrador genera un enlace de un solo uso que **vence en 30 minutos**; generar otro invalida el anterior. En la base solo se guarda el hash del token. (Este enlace ya fue usado y no sirve.) |
| 33 | ![Restablecida](33-restablecer-ok.png) | Con el enlace, la persona fija su contraseña nueva; se cierran sus sesiones abiertas y se levanta cualquier bloqueo. |
| 34 | ![Enlace reusado](34-restablecer-reusado.png) | El **mismo enlace usado otra vez es rechazado**: "El enlace no es válido o ya expiró" (token de un solo uso). |
| 35 | ![Bloqueo](35-login-bloqueo.png) | **Bloqueo por intentos fallidos**: tras 5 contraseñas incorrectas la cuenta queda bloqueada temporalmente. |
| 35b | ![Usuario bloqueado](35b-web-usuario-bloqueado.png) | El administrador ve la cuenta **Bloqueada** y puede desbloquearla. |
| 36 | ![Auditor](36-roles-auditor.png) | **Control por roles**: el usuario AUDITOR solo consulta; su menú no incluye Usuarios y no tiene botones para crear ni modificar. La API valida el rol en cada ruta (guards `@Roles`). |

## F. Auditoría

| # | Captura | Qué demuestra |
|---|---|---|
| 37 | ![Auditoría](37-auditoria-lista.png) | **Bitácora de auditoría**: quién hizo qué, cuándo y desde qué IP. Se ven inicios de sesión exitosos y fallidos, el bloqueo y desbloqueo, la recuperación de contraseña (`RECUPERACION_GENERADA_ADMIN`, `TOKEN_VALIDADO`, `PASSWORD_RESTABLECIDA`), inspecciones de calidad, procesos, etiquetas QR y pesajes. Se puede filtrar por entidad, acción y fechas. |
| 38 | ![Detalle](38-auditoria-detalle.png) | Detalle de un registro con el estado **antes y después**. Los campos sensibles (contraseñas, tokens, QR, DPI) se guardan como **`[OCULTO]`**. |

---

## Resumen de cobertura

| Requisito | Evidencias |
|---|---|
| HTTPS, despliegue en la nube y contenedores | 01, 02, 07 |
| CI/CD con pruebas automatizadas y registry | 04, 05, 06 |
| Documentación de la API | 03 |
| Logs | 08 |
| PWA instalable, captura en campo con fotos | 09–13, 16 |
| Funcionamiento sin conexión y sincronización | 14, 15 |
| Productor y entregas recientes | 17 |
| Tareas pendientes e inspección de calidad (PWA) | 18–21 |
| Dashboard con datos reales | 22 |
| Recepciones, pesajes e historial | 23, 24 |
| Lotes, QR y lectura del QR en campo | 25, 26 |
| Control de calidad en la web | 27, 27b |
| Trazabilidad hacia atrás y hacia adelante | 28, 28b |
| Procesos (división) | 29 |
| Exportación a Excel | 30 |
| Usuarios, roles y centros | 31, 36 |
| Recuperación de contraseña con token que expira | 32–34 |
| Bloqueo por intentos fallidos | 35, 35b |
| Auditoría | 37, 38 |

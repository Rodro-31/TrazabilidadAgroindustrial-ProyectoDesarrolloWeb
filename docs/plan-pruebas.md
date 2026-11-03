# Plan de Pruebas Funcionales y Reglas de Negocio

Este documento recoge las pruebas funcionales aplicadas a la plataforma en el entorno de producción:

- Aplicación web: https://app.x-dev.store
- PWA de campo: https://campo.x-dev.store
- API y Swagger: https://api.x-dev.store/api/docs

Para cada caso se contrasta el resultado esperado frente al obtenido y se indica la evidencia. Las capturas están en [`evidencias/`](evidencias/README.md), numeradas del 01 al 38.

**Leyenda del resultado obtenido**

- **ÉXITO:** la prueba se ejecutó y el resultado coincide con lo esperado.
- **Por ejecutar:** caso redactado con su resultado esperado; falta ejecutarlo en producción y anotar el resultado y la captura.

**Usuarios de prueba:** `admin@`, `supervisor@`, `calidad@`, `bascula@`, `campo@` y `auditor@` con dominio `demo.x-dev.store` (contraseña entregada por separado).

**Convención para capturas nuevas:** `pr-XX-descripcion.png` dentro de `docs/evidencias/`.

---

## 1. Reglas de negocio

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-01** | Regla 6: toda operación sensible queda auditada | 1. Ejecutar las pruebas unitarias del backend (`npm test`).<br>2. Revisar la prueba "si falla el registro de auditoría, la respuesta al cliente no se rompe" de `AuditoriaInterceptor`.<br>3. En producción, registrar una recepción o un pesaje y abrir **Auditoría** en la web. | El interceptor guarda usuario, acción, antes/después, IP y fecha. Si la base de auditoría falla, la respuesta al usuario no se rompe y el error queda en los logs. | **ÉXITO:** las 86 pruebas del backend pasan (11 suites). El mensaje `base caída` que aparece en la consola es un error **simulado a propósito** por esa prueba para comprobar la resiliencia del interceptor; no es un fallo del sistema. En producción, la bitácora muestra usuario, acción, IP y estado antes/después. | `pruebas unitarias_2.png` (salida de consola), `05-actions-tests.png`, `37-auditoria-lista.png`, `38-auditoria-detalle.png` |
| **PR-02** | Regla 4: el histórico de pesajes no se sobrescribe | 1. Iniciar sesión en la PWA con rol ADMIN.<br>2. Abrir el detalle de una recepción existente.<br>3. Ingresar un nuevo peso y pulsar "Registrar nuevo pesaje". | Se agrega el pesaje nuevo y el anterior permanece en el "Historial de pesajes". | **ÉXITO:** el historial muestra el pesaje original (Neto 98.00 kg) de forma secuencial, sin sobrescribirse. | `pwa-04-detalle_2.png`, `16-pwa-detalle-recepcion.png`, `24-web-recepcion-pesaje.png` |
| **PR-03** | PWA: sincronización offline (retención local) | 1. Desactivar la red en DevTools (modo Offline).<br>2. Llenar y guardar una recepción nueva.<br>3. Revisar "Envíos y comprobantes". | La recepción se retiene localmente (IndexedDB) con estado pendiente. | **ÉXITO:** la PWA muestra la etiqueta "Sin conexión" y aloja el registro (P-0005 Domingo Tiul Coc) en "Por enviar". | `pwa-05-offline_2.png`, `14-pwa-offline-pendiente.png` |
| **PR-04** | Tokens: QR de recepción sin datos sensibles | 1. En la PWA, ir a "Envíos y comprobantes".<br>2. Pulsar "Ver QR" en un comprobante enviado. | Se muestra un QR basado en un valor aleatorio, sin exponer datos en texto plano. | **ÉXITO:** el QR se despliega correctamente, listo para lectura o impresión. | `pwa-03-comprobante-qr_2.png`, `13-pwa-comprobante-qr.png` |
| **PR-05** | Regla 1: no hay lotes sin origen identificable | 1. Iniciar sesión en la web como `bascula@`.<br>2. Lotes → "Nuevo lote".<br>3. Elegir un centro y **no** seleccionar ninguna recepción de origen.<br>4. Intentar guardar. | No se crea el lote. El sistema exige al menos una recepción de origen ("un lote debe tener al menos una recepción de origen"). | Por ejecutar | `pr-05-lote-sin-origen.png` |
| **PR-06** | Regla 1 / 2: una recepción no se asigna por encima de sus kg disponibles | 1. Crear un lote tomando **todos** los kg de una recepción.<br>2. Intentar crear un segundo lote con esa misma recepción. | El sistema rechaza la operación: la recepción ya fue asignada completamente a otro lote. | Por ejecutar | `pr-06-recepcion-asignada.png` |
| **PR-07** | Regla 2: no mover más de la existencia | 1. Iniciar sesión como `bascula@`.<br>2. Traslados → "Despachar lote" e intentar despachar un lote en estado **Agotado** (por ejemplo el lote de entrada de la división, evidencia 29). Si la lista solo ofrece lotes activos, hacerlo desde Swagger (`POST /traslados`). | El sistema rechaza el traslado: solo se trasladan lotes ACTIVOS con existencia. La existencia nunca queda negativa (también protegida por la restricción `CHECK (cantidad_kg >= 0)` en la base). | Por ejecutar | `pr-07-traslado-agotado.png` |
| **PR-08** | Regla 3: cada cambio de estado del lote queda registrado | 1. Como `bascula@`, despachar un lote activo a otro centro.<br>2. Abrir el detalle del lote → "Historial de estados".<br>3. Confirmar la recepción en el centro destino y volver a revisar el historial. | El historial muestra el paso a EN_TRANSITO al despachar y el regreso a ACTIVO al confirmar la recepción, cada uno con fecha y usuario. | Por ejecutar | `pr-08-historial-estados.png` |
| **PR-09** | Regla 5: evitar recepciones duplicadas | 1. En Swagger, autenticarse como `bascula@` o `campo@`.<br>2. Enviar `POST /recepciones` con un cuerpo válido y un `id` (UUID) propio.<br>3. Enviar exactamente la misma petición otra vez. | La primera respuesta es **201** (creada). La segunda es **200** y no crea ni modifica nada: en la web solo aparece una recepción con ese UUID. | Por ejecutar | `pr-09-recepcion-duplicada.png` |

## 2. Tokens y códigos QR

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-10** | Token de recuperación: un solo uso | 1. Como `admin@`, en Usuarios generar un enlace de recuperación para un usuario.<br>2. Abrir el enlace y fijar una contraseña nueva.<br>3. Volver a abrir el mismo enlace. | La primera vez se restablece la contraseña. La segunda vez se rechaza con "El enlace no es válido o ya expiró". | **ÉXITO:** el enlace usado por segunda vez es rechazado. | `33-restablecer-ok.png`, `34-restablecer-reusado.png` |
| **PR-11** | Token de recuperación: expira a los 30 minutos | 1. Generar un enlace de recuperación.<br>2. Esperar más de 30 minutos sin usarlo.<br>3. Abrirlo. | Se rechaza con "El enlace no es válido o ya expiró". | Por ejecutar | `pr-11-enlace-expirado.png` |
| **PR-12** | Token de recuperación: generar uno nuevo invalida el anterior | 1. Generar un enlace para un usuario y copiarlo.<br>2. Generar otro enlace para el mismo usuario.<br>3. Abrir el primer enlace. | El primer enlace queda revocado y se rechaza. Solo sirve el más reciente. | Por ejecutar | `pr-12-enlace-revocado.png` |
| **PR-13** | Token de traslado: confirmación con código válido | 1. Como `bascula@`, despachar un lote: la pantalla muestra el código de confirmación una sola vez.<br>2. Con un usuario del centro **destino**, abrir el traslado → "Confirmar recepción" con el código. | El traslado pasa a RECIBIDO, el lote vuelve a ACTIVO en el centro destino y el código queda marcado como usado. | Por ejecutar | `pr-13-traslado-confirmado.png` |
| **PR-14** | Token de traslado: código usado o ajeno es rechazado | 1. Intentar confirmar de nuevo el traslado ya recibido con el mismo código.<br>2. Intentar confirmar otro traslado con el código de este. | Se rechaza: "El código de confirmación ya fue usado" o "no corresponde a este traslado". | Por ejecutar | `pr-14-traslado-token-rechazado.png` |
| **PR-15** | QR de lote: lectura desde la PWA | 1. En la web, abrir un lote y mostrar su etiqueta QR.<br>2. En la PWA, "Escanear" el QR. | La PWA abre el detalle del lote: estado, existencia, ubicación y recepciones de origen. | **ÉXITO:** el QR del lote abre su detalle en la PWA. | `26-pwa-escanear-lote.png` |
| **PR-16** | QR: reimprimir revoca el anterior | 1. Como `bascula@`, en el detalle de un lote pulsar "Reimprimir etiqueta".<br>2. Intentar abrir el QR **anterior**. | El QR anterior queda revocado y el nuevo funciona. | Por ejecutar | `pr-16-qr-revocado.png` |

## 3. Autenticación y permisos por rol

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-17** | Bloqueo por intentos fallidos | 1. En el login, ingresar 5 veces una contraseña incorrecta para un mismo correo.<br>2. Intentar entrar con la contraseña correcta.<br>3. Como `admin@`, abrir Usuarios. | La cuenta queda bloqueada temporalmente (15 minutos). El administrador la ve como "Bloqueada" y puede desbloquearla. | **ÉXITO:** tras 5 intentos fallidos la cuenta se bloquea y aparece como Bloqueada en Usuarios. | `35-login-bloqueo.png`, `35b-web-usuario-bloqueado.png` |
| **PR-18** | Mensaje de error genérico | 1. Intentar entrar con un correo que no existe.<br>2. Intentar entrar con un correo real y contraseña incorrecta. | En ambos casos el mensaje es "Credenciales inválidas": no revela si el correo existe. | Por ejecutar | `pr-18-credenciales-invalidas.png` |
| **PR-19** | Rol AUDITOR: solo lectura | 1. Iniciar sesión como `auditor@`.<br>2. Revisar el menú y las pantallas de Lotes, Recepciones y Catálogos. | El menú no incluye Usuarios y no hay botones para crear ni modificar. La API rechaza escrituras con 403. | **ÉXITO:** el menú del auditor no incluye Usuarios y las pantallas no ofrecen acciones de modificación. | `36-roles-auditor.png` |
| **PR-20** | Un rol intenta algo prohibido (API) | 1. En Swagger, autenticarse como `bascula@`.<br>2. Ejecutar `POST /usuarios` (crear usuario). | La API responde **403 Forbidden**: solo ADMIN gestiona usuarios. | Por ejecutar | `pr-20-403-usuarios.png` |
| **PR-21** | Un rol intenta algo prohibido (API, escritura) | 1. En Swagger, autenticarse como `auditor@`.<br>2. Ejecutar `POST /lotes`. | La API responde **403 Forbidden**. | Por ejecutar | `pr-21-403-auditor.png` |
| **PR-22** | Rol CALIDAD: menú limitado | 1. Iniciar sesión como `calidad@` en la web. | El menú no incluye Usuarios, Auditoría, Liquidaciones ni Precios. Puede registrar inspecciones. | Por ejecutar | `pr-22-menu-calidad.png` |
| **PR-23** | Rol CAMPO en la web | 1. Iniciar sesión como `campo@` en `app.x-dev.store`. | Se muestra: "Tu rol no tiene módulos en la web de administración. Usa la app de campo." | Por ejecutar | `pr-23-campo-en-web.png` |
| **PR-24** | Restablecer contraseña cierra las sesiones abiertas | 1. Con una sesión abierta del usuario, restablecer su contraseña con un enlace.<br>2. Intentar usar la sesión anterior. | Las sesiones anteriores se cierran y se levanta cualquier bloqueo. | **ÉXITO:** la contraseña se restablece y las sesiones abiertas se cierran. | `33-restablecer-ok.png` |

## 4. Validaciones de formularios

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-25** | Recepción: peso bruto inválido | 1. En la PWA, "Nueva recepción".<br>2. Ingresar peso bruto 0 (o negativo) y guardar. | No se guarda; se indica que el peso debe ser mayor que cero. | Por ejecutar | `pr-25-peso-invalido.png` |
| **PR-26** | Recepción: tara mayor o igual al peso bruto | 1. En "Nueva recepción", ingresar peso bruto 10 kg y tara 12 kg. | No se guarda: el peso neto debe ser mayor que cero. | Por ejecutar | `pr-26-tara-invalida.png` |
| **PR-27** | Inspección: porcentajes fuera de rango | 1. En Calidad → "Registrar inspección", ingresar humedad 120 %. | Se rechaza: los porcentajes deben estar entre 0 y 100. | Por ejecutar | `pr-27-humedad-invalida.png` |
| **PR-28** | Contraseña nueva demasiado corta | 1. Abrir un enlace de recuperación válido.<br>2. Ingresar una contraseña de 5 caracteres. | Se rechaza: mínimo 8 caracteres. | Por ejecutar | `pr-28-password-corta.png` |
| **PR-29** | Lote: no mezclar productos distintos | 1. En Lotes → "Nuevo lote", seleccionar recepciones de producto distinto (uva, pergamino u oro). | Se muestra "No se puede mezclar uva, pergamino y oro en un mismo lote." | Por ejecutar | `pr-29-mezcla-productos.png` |
| **PR-30** | Lote: anular exige motivo | 1. Como `admin@`, abrir un lote activo → "Anular lote".<br>2. Escribir un motivo de menos de 5 caracteres. | Se rechaza: el motivo debe tener entre 5 y 300 caracteres. | Por ejecutar | `pr-30-anular-sin-motivo.png` |
| **PR-31** | Proceso: forma de entradas y salidas | 1. Como `supervisor@`, Procesos → "Registrar proceso" de tipo DIVISION con una sola salida. | Se rechaza: "DIVISION produce al menos dos lotes". | Por ejecutar | `pr-31-division-invalida.png` |

## 5. Funcionamiento sin conexión

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-32** | Sincronización automática al recuperar la red | 1. Con la PWA en modo avión, registrar una recepción con foto.<br>2. Quitar el modo avión. | La cola se envía sola y la recepción llega al servidor con su foto, sin duplicarse. | **ÉXITO:** la recepción capturada sin conexión (497 kg) aparece en el servidor con su foto. | `14-pwa-offline-pendiente.png`, `15-pwa-offline-enviada.png` |
| **PR-33** | Inspección de calidad sin conexión | 1. Como `calidad@` en la PWA, activar modo avión.<br>2. Registrar una inspección.<br>3. Recuperar la red. | La inspección se guarda en la cola y se sincroniza al volver la conexión. | Por ejecutar | `pr-33-inspeccion-offline.png` |

## 6. Flujo funcional y trazabilidad

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-34** | Trazabilidad hacia atrás y hacia adelante | 1. En la web, abrir un lote → "Ver trazabilidad".<br>2. Repetir con un lote derivado. | Se ven productores, fincas y kg aportados (hacia atrás) y lotes derivados (hacia adelante). Un lote derivado llega hasta sus productores originales. | **ÉXITO:** el lote L-2026-00003 se traza hasta L-2026-00001 por división y, a través de él, a los productores y fincas originales. | `28-web-trazabilidad.png`, `28b-web-trazabilidad-derivado.png` |
| **PR-35** | Proceso de división | 1. Como `supervisor@`, registrar una división de un lote. | El lote de entrada pasa a Agotado y nacen los lotes hijo, cada uno con su etiqueta QR. | **ÉXITO:** el proceso PR-2026-0001 agota el lote de entrada y crea los lotes hijo. | `29-web-procesos.png` |
| **PR-36** | Tarea de inspección automática | 1. Registrar una recepción nueva.<br>2. Como `calidad@`, abrir "Tareas pendientes" y registrar la inspección. | Cada recepción genera una tarea para el rol CALIDAD; al registrar la inspección la tarea se cierra sola. | **ÉXITO:** las tareas aparecen y se cierran al registrar la inspección. | `18-pwa-tareas.png`, `20-pwa-inspeccion-guardada.png`, `21-pwa-tarea-cerrada.png` |
| **PR-37** | Exportación de listados | 1. En Recepciones, pulsar "Exportar". | Se descarga un archivo que abre en Excel con acentos y ñ correctos. | **ÉXITO:** el archivo exportado abre en Excel correctamente. | `30-web-exportar-excel.png` |

## 7. Infraestructura

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-38** | HTTPS con certificado válido | 1. Abrir `https://app.x-dev.store`. | Se muestra el candado de conexión segura. | **ÉXITO:** certificado válido (Caddy + Let's Encrypt). | `01-https-candado.png` |
| **PR-39** | Pipeline CI/CD | 1. Revisar GitHub Actions tras un merge a `main`. | Los pasos `test → build-push → deploy` terminan en verde y las imágenes aparecen en `ghcr.io`. | **ÉXITO:** pipeline en verde; imágenes `trazabilidad-api`, `trazabilidad-web` y `trazabilidad-pwa` publicadas. | `04-actions-pipeline.png`, `06-registry-packages.png` |
| **PR-40** | Documentación de la API | 1. Abrir `https://api.x-dev.store/api/docs`. | Swagger lista todos los endpoints con una descripción. | **PARCIAL:** Swagger carga, pero la mayoría de los endpoints no tiene descripción (`@ApiOperation`). Reportado como Issue. | `03-swagger.png` |

---

## Resumen

| Estado | Casos |
|---|---|
| ÉXITO | PR-01, 02, 03, 04, 10, 15, 17, 19, 24, 32, 34, 35, 36, 37, 38, 39 |
| Parcial | PR-40 |
| Por ejecutar | PR-05 a 09, 11 a 14, 16, 18, 20 a 23, 25 a 31, 33 |

Los errores que se encuentren al ejecutar los casos pendientes se reportan como **Issues** en GitHub con los pasos para reproducirlos.

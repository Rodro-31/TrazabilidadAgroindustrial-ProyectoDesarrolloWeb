# Plan de Pruebas Funcionales y Reglas de Negocio

Este documento recoge las pruebas funcionales aplicadas a la plataforma en el entorno de producción:

- Aplicación web: https://app.x-dev.store
- PWA de campo: https://campo.x-dev.store
- API y Swagger: https://api.x-dev.store/api/docs

Para cada caso se contrasta el resultado esperado frente al obtenido y se indica la evidencia. Las capturas están en [`evidencias/`](evidencias/README.md), numeradas del 01 al 38.

**Leyenda del resultado obtenido**

- **ÉXITO:** la prueba se ejecutó y el resultado coincide con lo esperado.
- **PARCIAL:** la prueba se ejecutó y se encontró una observación, reportada como Issue.

**Usuarios de prueba:** `admin@`, `supervisor@`, `calidad@`, `bascula@`, `campo@` y `auditor@` con dominio `demo.x-dev.store` (contraseña entregada por separado).

---

## 1. Reglas de negocio

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-01** | Regla 6: toda operación sensible queda auditada | 1. Ejecutar las pruebas unitarias del backend (`npm test`).<br>2. Revisar la prueba "si falla el registro de auditoría, la respuesta al cliente no se rompe" de `AuditoriaInterceptor`.<br>3. En producción, registrar una recepción o un pesaje y abrir **Auditoría** en la web. | El interceptor guarda usuario, acción, antes/después, IP y fecha. Si la base de auditoría falla, la respuesta al usuario no se rompe y el error queda en los logs. | **ÉXITO:** las 86 pruebas del backend pasan (11 suites). El mensaje `base caída` que aparece en la consola es un error **simulado a propósito** por esa prueba para comprobar la resiliencia del interceptor; no es un fallo del sistema. En producción, la bitácora muestra usuario, acción, IP y estado antes/después. | `05-actions-tests.png`, `37-auditoria-lista.png`, `38-auditoria-detalle.png` |
| **PR-02** | Regla 4: el histórico de pesajes no se sobrescribe | 1. Iniciar sesión en la PWA con rol ADMIN.<br>2. Abrir el detalle de una recepción existente.<br>3. Ingresar un nuevo peso y pulsar "Registrar nuevo pesaje". | Se agrega el pesaje nuevo y el anterior permanece en el "Historial de pesajes". | **ÉXITO:** el historial muestra el pesaje inicial (neto 497.00 kg) y la corrección (neto 492.00 kg, motivo "prueba correccion"); el anterior no se sobrescribe. | `16-pwa-detalle-recepcion.png`, `24-web-recepcion-pesaje.png` |
| **PR-03** | PWA: sincronización offline (retención local) | 1. Desactivar la red en DevTools (modo Offline).<br>2. Llenar y guardar una recepción nueva.<br>3. Revisar "Envíos y comprobantes". | La recepción se retiene localmente (IndexedDB) con estado pendiente. | **ÉXITO:** la PWA muestra la etiqueta "Sin conexión" y aloja el registro (P-0006 Ana Cucul Xol, 497.00 kg) y su foto en "Por enviar". | `14-pwa-offline-pendiente.png` |
| **PR-04** | Tokens: QR de recepción sin datos sensibles | 1. En la PWA, ir a "Envíos y comprobantes".<br>2. Pulsar "Ver QR" en un comprobante enviado. | Se muestra un QR basado en un valor aleatorio, sin exponer datos en texto plano. | **ÉXITO:** el QR se despliega correctamente, listo para lectura o impresión. | `13-pwa-comprobante-qr.png` |

## 2. Tokens y códigos QR

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-05** | Token de recuperación: un solo uso | 1. Como `admin@`, en Usuarios generar un enlace de recuperación para un usuario.<br>2. Abrir el enlace y fijar una contraseña nueva.<br>3. Volver a abrir el mismo enlace. | La primera vez se restablece la contraseña. La segunda vez se rechaza con "El enlace no es válido o ya expiró". | **ÉXITO:** el enlace usado por segunda vez es rechazado. | `33-restablecer-ok.png`, `34-restablecer-reusado.png` |
| **PR-06** | QR de lote: lectura desde la PWA | 1. En la web, abrir un lote y mostrar su etiqueta QR.<br>2. En la PWA, "Escanear" el QR. | La PWA abre el detalle del lote: estado, existencia, ubicación y recepciones de origen. | **ÉXITO:** el QR del lote abre su detalle en la PWA. | `26-pwa-escanear-lote.png` |

## 3. Autenticación y permisos por rol

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-07** | Bloqueo por intentos fallidos | 1. En el login, ingresar 5 veces una contraseña incorrecta para un mismo correo.<br>2. Intentar entrar con la contraseña correcta.<br>3. Como `admin@`, abrir Usuarios. | La cuenta queda bloqueada temporalmente (15 minutos). El administrador la ve como "Bloqueada" y puede desbloquearla. | **ÉXITO:** tras 5 intentos fallidos la cuenta se bloquea y aparece como Bloqueada en Usuarios. | `35-login-bloqueo.png`, `35b-web-usuario-bloqueado.png` |
| **PR-08** | Rol AUDITOR: solo lectura | 1. Iniciar sesión como `auditor@`.<br>2. Revisar el menú y las pantallas de Lotes, Recepciones y Catálogos. | El menú no incluye Usuarios y no hay botones para crear ni modificar. La API rechaza escrituras con 403. | **ÉXITO:** el menú del auditor no incluye Usuarios y las pantallas no ofrecen acciones de modificación. | `36-roles-auditor.png` |
| **PR-09** | Restablecer contraseña cierra las sesiones abiertas | 1. Con una sesión abierta del usuario, restablecer su contraseña con un enlace.<br>2. Intentar usar la sesión anterior. | Las sesiones anteriores se cierran y se levanta cualquier bloqueo. | **ÉXITO:** la contraseña se restablece y las sesiones abiertas se cierran. | `33-restablecer-ok.png` |

## 4. Funcionamiento sin conexión

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-10** | Sincronización automática al recuperar la red | 1. Con la PWA en modo avión, registrar una recepción con foto.<br>2. Quitar el modo avión. | La cola se envía sola y la recepción llega al servidor con su foto, sin duplicarse. | **ÉXITO:** la recepción capturada sin conexión (497 kg) aparece en el servidor con su foto. | `14-pwa-offline-pendiente.png`, `15-pwa-offline-enviada.png` |

## 5. Flujo funcional y trazabilidad

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-11** | Trazabilidad hacia atrás y hacia adelante | 1. En la web, abrir un lote → "Ver trazabilidad".<br>2. Repetir con un lote derivado. | Se ven productores, fincas y kg aportados (hacia atrás) y lotes derivados (hacia adelante). Un lote derivado llega hasta sus productores originales. | **ÉXITO:** el lote L-2026-00003 se traza hasta L-2026-00001 por división y, a través de él, a los productores y fincas originales. | `28-web-trazabilidad.png`, `28b-web-trazabilidad-derivado.png` |
| **PR-12** | Proceso de división | 1. Como `supervisor@`, registrar una división de un lote. | El lote de entrada pasa a Agotado y nacen los lotes hijo, cada uno con su etiqueta QR. | **ÉXITO:** el proceso PR-2026-0001 agota el lote de entrada y crea los lotes hijo. | `29-web-procesos.png` |
| **PR-13** | Tarea de inspección automática | 1. Registrar una recepción nueva.<br>2. Como `calidad@`, abrir "Tareas pendientes" y registrar la inspección. | Cada recepción genera una tarea para el rol CALIDAD; al registrar la inspección la tarea se cierra sola. | **ÉXITO:** las tareas aparecen y se cierran al registrar la inspección. | `18-pwa-tareas.png`, `20-pwa-inspeccion-guardada.png`, `21-pwa-tarea-cerrada.png` |
| **PR-14** | Exportación de listados | 1. En Recepciones, pulsar "Exportar". | Se descarga un archivo que abre en Excel con acentos y ñ correctos. | **ÉXITO:** el archivo exportado abre en Excel correctamente. | `30-web-exportar-excel.png` |

## 6. Infraestructura

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-15** | HTTPS con certificado válido | 1. Abrir `https://app.x-dev.store`. | Se muestra el candado de conexión segura. | **ÉXITO:** certificado válido (Caddy + Let's Encrypt). | `01-https-candado.png` |
| **PR-16** | Pipeline CI/CD | 1. Revisar GitHub Actions tras un merge a `main`. | Los pasos `test → build-push → deploy` terminan en verde y las imágenes aparecen en `ghcr.io`. | **ÉXITO:** pipeline en verde; imágenes `trazabilidad-api`, `trazabilidad-web` y `trazabilidad-pwa` publicadas. | `04-actions-pipeline.png`, `06-registry-packages.png` |
| **PR-17** | Documentación de la API | 1. Abrir `https://api.x-dev.store/api/docs`. | Swagger lista todos los endpoints con una descripción. | **PARCIAL:** Swagger carga, pero la mayoría de los endpoints no tiene descripción (`@ApiOperation`). Reportado como Issue. | `03-swagger.png` |

---

## Resumen

Se ejecutaron **17 casos** en el entorno de producción. Los errores o hallazgos se reportan como **Issues** en GitHub con los pasos para reproducirlos.

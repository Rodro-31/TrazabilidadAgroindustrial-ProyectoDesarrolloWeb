# Plan de Pruebas Funcionales y Reglas de Negocio

Este documento recoge las pruebas funcionales aplicadas a la plataforma. Las secciones 1 a 6 se ejecutaron en el entorno de producción; la sección 7, contra la API en un entorno local con datos de prueba:

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

## 7. Reglas de negocio obligatorias, traslados y liquidaciones (API)

Ejecutadas el 3/11/2026 a la 1:20 a. m. contra la API (NestJS + PostgreSQL) en un **entorno local con datos de prueba**, con usuarios ADMIN, SUPERVISOR y BASCULA (centro CA-03). Las pruebas llaman directamente a la API, la misma que usan la web y la PWA. Resultado: **13 de 13 con el resultado esperado**. Salida completa: [`evidencias/salida-pruebas-reglas.txt`](evidencias/salida-pruebas-reglas.txt).

| ID | Regla / Requisito | Pasos | Resultado esperado | Resultado obtenido | Evidencia |
|---|---|---|---|---|---|
| **PR-18** | Regla 1: no permitir lotes sin origen | `POST /lotes` sin recepciones de origen | Se rechaza (400) | **ÉXITO:** HTTP 400 "Datos inválidos" | `salida-pruebas-reglas.txt` (R1) |
| **PR-19** | Regla 2: no mover más de la existencia | Proceso que toma 9 999 kg del lote L-2026-00001 (existencia 418 kg) | Se rechaza (400) | **ÉXITO:** HTTP 400 "El lote L-2026-00001 solo tiene 418.00 kg en este centro" | `salida-pruebas-reglas.txt` (R2) |
| **PR-20** | Regla 2: no asignar una recepción por encima de sus kg | Crear otro lote con una recepción ya asignada por completo | Se rechaza (409) | **ÉXITO:** HTTP 409 "La recepción … ya fue asignada completamente a otro lote" | `salida-pruebas-reglas.txt` (R2b) |
| **PR-21** | Regla 3: cada cambio de estado del lote queda registrado | Consultar el historial de estados de L-2026-00001 después de procesarlo | Historial con cada cambio, motivo y usuario | **ÉXITO:** HTTP 200 · (nuevo) → ACTIVO "Creación del lote" · ACTIVO → AGOTADO "Consumido en el proceso PR-2026-0001" | `salida-pruebas-reglas.txt` (R3) |
| **PR-22** | Regla 5: evitar recepciones duplicadas (identificador único) | Enviar dos veces `POST /recepciones` con el mismo UUID; la segunda vez con otro peso | La primera crea (201); la segunda devuelve la existente (200) sin duplicar ni cambiarla | **ÉXITO:** 1.º envío 201 · 2.º envío 200 con neto 118 kg (no 997) · un solo registro con ese id | `salida-pruebas-reglas.txt` (R5) |
| **PR-23** | Traslado: código ajeno o inventado | Despachar TR-2026-0001 (L-2026-00003, CA-01 → CA-02, 700 kg) y recibir con otro código | Se rechaza (400) | **ÉXITO:** HTTP 400 "El código de confirmación no corresponde a este traslado" | `salida-pruebas-reglas.txt` (T1) |
| **PR-24** | Traslado: solo recibe el centro destino | Recibir con usuario BASCULA de CA-03 | Se rechaza (403) | **ÉXITO:** HTTP 403 "Solo el personal del centro de destino puede recibir este traslado" | `salida-pruebas-reglas.txt` (T2) |
| **PR-25** | Traslado: recibir con código válido y merma | Recibir en CA-02 con el código correcto, declarando 697 kg | Traslado RECIBIDO, lote ACTIVO en destino, merma registrada | **ÉXITO:** HTTP 200 · enviado 700 kg · recibido 697 kg (merma 3 kg) · lote ACTIVO | `salida-pruebas-reglas.txt` (T3) |
| **PR-26** | Traslado: código de un solo uso | Reusar el mismo código | Se rechaza (410) | **ÉXITO:** HTTP 410 "El código de confirmación ya fue usado o fue anulado" | `salida-pruebas-reglas.txt` (T4) |
| **PR-27** | Liquidación: quien crea no aprueba | SUPERVISOR crea LQ-2026-0001 (418 kg, Q 6 061) e intenta aprobarla | Se rechaza (403) | **ÉXITO:** HTTP 403 "Quien creó la liquidación no puede aprobarla: debe hacerlo otra persona" | `salida-pruebas-reglas.txt` (L1) |
| **PR-28** | Liquidación: otra persona aprueba | ADMIN aprueba LQ-2026-0001 | Estado APROBADA | **ÉXITO:** HTTP 200 · APROBADA por Administrador | `salida-pruebas-reglas.txt` (L2) |
| **PR-29** | Liquidación: solo ADMIN registra el pago | SUPERVISOR intenta registrar el pago | Se rechaza (403) | **ÉXITO:** HTTP 403 "No tienes permiso para esta operación" | `salida-pruebas-reglas.txt` (L3) |
| **PR-30** | Liquidación: pago | ADMIN registra el pago | Estado PAGADA | **ÉXITO:** HTTP 200 · PAGADA | `salida-pruebas-reglas.txt` (L4) |

## Resumen

Se ejecutaron **30 casos**: 17 en el entorno de producción (PR-01 a PR-17) y 13 sobre reglas de negocio, traslados y liquidaciones (PR-18 a PR-30) contra la API en un entorno local con datos de prueba. **29 con éxito y 1 parcial** (PR-17, documentación de Swagger, reportado como Issue #56). Los errores o hallazgos se reportan como **Issues** en GitHub con los pasos para reproducirlos.

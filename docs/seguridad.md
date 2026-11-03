# Seguridad, Autenticación y Control de Acceso

La plataforma implementa un esquema de seguridad robusto diseñado para proteger la integridad de la trazabilidad agroindustrial, asegurar las transacciones offline/online y auditar cada movimiento de inventario o cambio de estado.

## 1. Autenticación

Se descartó el uso de proveedores externos (como Auth0) para implementar un control total sobre el ciclo de vida de la identidad:
*   **Cifrado de Credenciales:** Las contraseñas se almacenan mediante un hash seguro utilizando **bcrypt**.
*   **Sesiones (JWT):** Se emplean JSON Web Tokens (JWT) de corta duración (**15 minutos**) para el acceso a la API, complementados con *Refresh Tokens* de **7 días** que rotan en cada uso: el token usado queda revocado y se emite uno nuevo.
*   **Bloqueo por intentos fallidos:** tras **5** contraseñas incorrectas la cuenta se bloquea **15 minutos**. El administrador puede ver la cuenta bloqueada y desbloquearla desde la pantalla Usuarios.
*   **Mensajes genéricos:** ante un error de acceso el sistema responde "Credenciales inválidas" sin revelar si el correo existe.

## 2. Roles del Sistema

El acceso a los distintos módulos (Web y PWA) está protegido mediante *guards* en el backend que validan los permisos según el rol del usuario autenticado. La web oculta los botones que un rol no puede usar, pero el permiso real lo valida siempre la API.

| Rol | Nivel de Acceso y Funciones |
|---|---|
| **Administrador** | Acceso total al sistema, incluyendo la gestión de usuarios, roles, centros de acopio y registro de pagos. |
| **Supervisor** | Registra y gestiona la operación: despacha y cancela traslados, registra procesos, crea y aprueba liquidaciones, administra productores, fincas, organizaciones, compradores y precios, y puede ver el DPI de los productores. Los traslados y los procesos no requieren aprobación: se registran o se despachan directamente. Solo las liquidaciones se aprueban. |
| **Calidad** | Registra inspecciones (en la web y en la PWA) y gestiona el catálogo de grados de calidad (por ejemplo, Primera). Consulta recepciones, lotes, traslados y procesos. |
| **Báscula / Bodega** | Realiza pesajes y recepciones, crea lotes, despacha y recibe traslados, e imprime comprobantes y etiquetas. |
| **Campo** | Usuario de la PWA: registra recepciones en fincas, captura fotos y escanea QR. No registra inspecciones. |
| **Auditor** | Acceso de solo lectura a todos los módulos, incluida la auditoría, salvo la gestión de usuarios. |

## 3. Segregación de Funciones

Las operaciones que mueven dinero tienen controles adicionales:

*   **Quien crea una liquidación no puede aprobarla:** si el mismo usuario intenta aprobarla, la API responde **403** ("Quien creó la liquidación no puede aprobarla: debe hacerlo otra persona"). La aprobación la hace otro Administrador o Supervisor.
*   **Solo el Administrador registra el pago** de una liquidación aprobada; el Supervisor recibe **403**.
*   **Anular un lote** y **cancelar un traslado** están reservados a Administrador y Supervisor, y exigen un motivo que queda en el historial.

## 4. Gestión de Tokens y Códigos QR

El sistema utiliza tokens de un solo uso o con expiración estricta para garantizar la seguridad de operaciones periféricas:
*   **QR de Recepción y Lotes:** Los códigos QR generados no exponen datos sensibles en texto plano. Contienen un valor aleatorio cuyo *hash* se verifica contra la base de datos. Estos QR no expiran (identifican al lote o recepción), pero pueden revocarse.
*   **Confirmación de Traslados:** Se emite un código de confirmación temporal (vigencia de **72 horas**) para validar la recepción del lote en el centro de destino. Al utilizarse se marca como usado, y al cancelar el traslado se revoca. Solo el personal del centro de destino puede recibirlo.
*   **Recuperación de Contraseña:** Genera un token de un solo uso con una ventana de expiración máxima de 30 minutos. Generar un enlace nuevo invalida el anterior, y al restablecer la contraseña se cierran las sesiones abiertas y se levanta cualquier bloqueo.
*   *Nota:* Toda validación de token responde un estado claro (válido / expirado / usado / revocado) y deja un registro en auditoría.

## 5. Protección de Datos Sensibles

*   **DPI del productor:** solo lo ven el Administrador y el Supervisor, y únicamente en el detalle del productor. No aparece en las listas, en los QR ni en los datos de las recepciones. En la auditoría se guarda como `[OCULTO]`.
*   **Reportes CSV:** los archivos exportados se protegen contra la inyección de fórmulas. Si un texto empieza con `=`, `+`, `-` o `@` (o con tabulador o retorno de carro), se le antepone un apóstrofo (`'`) para que Excel lo trate como texto y no ejecute una fórmula.

## 6. Auditoría de Operaciones Sensibles (Regla 6)

Para cumplir con la trazabilidad inmutable, el backend cuenta con un **Interceptor Global de Auditoría**. Cada petición de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) en endpoints sensibles captura automáticamente:
*   ID y rol del usuario responsable.
*   Acción realizada y endpoint consumido.
*   Estado de la data (Antes / Después de la transacción).
*   Dirección IP, *user-agent* y marca de tiempo (fecha/hora).

Los campos sensibles (contraseñas, tokens, QR, DPI) se guardan como `[OCULTO]`. Las rutas `/auth` se excluyen del interceptor porque el servicio de autenticación audita sus propios eventos (inicio de sesión exitoso y fallido, bloqueo, recuperación de contraseña). Si el registro de auditoría falla, la respuesta al cliente no se rompe y el error queda en los logs de la API.

## 7. Infraestructura y Protección de Secretos

*   **Comunicaciones Seguras (HTTPS):** Caddy actúa como proxy inverso gestionando automáticamente los certificados TLS a través de Let's Encrypt para todas las aplicaciones (API, Web, PWA).
*   **Gestión de Secretos:** Las claves de base de datos, las firmas JWT y las credenciales de correo se inyectan a través de variables de entorno (`.env`). Nunca se exponen en el repositorio ni en las imágenes de Docker.
*   **Archivos subidos:** Las fotos se guardan en el disco del servidor (volumen `uploads`); en la base de datos solo se almacena la clave relativa y los metadatos.

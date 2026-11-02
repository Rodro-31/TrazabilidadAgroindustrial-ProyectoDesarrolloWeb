# Seguridad, Autenticación y Control de Acceso

La plataforma implementa un esquema de seguridad robusto diseñado para proteger la integridad de la trazabilidad agroindustrial, asegurar las transacciones offline/online y auditar cada movimiento de inventario o cambio de estado.

## 1. Autenticación

Se descartó el uso de proveedores externos (como Auth0) para implementar un control total sobre el ciclo de vida de la identidad:
*   **Cifrado de Credenciales:** Las contraseñas se almacenan mediante un hash seguro utilizando **bcrypt**.
*   **Sesiones (JWT):** Se emplean JSON Web Tokens (JWT) de corta duración para el acceso a la API, complementados con *Refresh Tokens* para mantener la sesión del usuario de forma segura.

## 2. Roles del Sistema

El acceso a los distintos módulos (Web y PWA) está protegido mediante *guards* en el backend que validan los permisos según el rol del usuario autenticado:

| Rol | Nivel de Acceso y Funciones |
|---|---|
| **Administrador** | Acceso total al sistema, incluyendo la gestión de usuarios, roles y configuración de catálogos. |
| **Supervisor** | Autoriza operaciones críticas: aprueba traslados entre centros, procesos de transformación y liquidaciones. |
| **Calidad** | Gestiona inspecciones de producto y determina los grados de clasificación (uva, pergamino, oro). |
| **Báscula / Bodega** | Realiza pesajes, recepciones, gestión de bodega e impresión de comprobantes y etiquetas. |
| **Campo** | Usuario exclusivo de la PWA: registra recepciones en fincas, captura fotos, escanea QR y realiza inspecciones preliminares. |
| **Auditor** | Acceso de solo lectura a todo el sistema, enfocado en revisar el historial y los logs de auditoría. |

## 3. Gestión de Tokens y Códigos QR

El sistema utiliza tokens de un solo uso o con expiración estricta para garantizar la seguridad de operaciones periféricas:
*   **QR de Recepción y Lotes:** Los códigos QR generados no exponen datos sensibles en texto plano. Contienen un valor aleatorio cuyo *hash* se verifica contra la base de datos.
*   **Confirmación de Traslados:** Se emite un token temporal para validar el movimiento de inventario entre centros. Al utilizarse, expira y se marca como consumido.
*   **Recuperación de Contraseña:** Genera un token de un solo uso con una ventana de expiración máxima de 30 minutos.
*   *Nota:* Toda validación de token responde un estado claro (válido / expirado / usado / revocado) y deja un registro en auditoría.

## 4. Auditoría de Operaciones Sensibles (Regla 6)

Para cumplir con la trazabilidad inmutable, el backend cuenta con un **Interceptor Global de Auditoría**. Cada petición de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) en endpoints sensibles captura automáticamente:
*   ID y rol del usuario responsable.
*   Acción realizada y endpoint consumido.
*   Estado de la data (Antes / Después de la transacción).
*   Dirección IP y marca de tiempo (fecha/hora).

## 5. Infraestructura y Protección de Secretos

*   **Comunicaciones Seguras (HTTPS):** Caddy actúa como proxy inverso gestionando automáticamente los certificados TLS a través de Let's Encrypt para todas las aplicaciones (API, Web, PWA).
*   **Gestión de Secretos:** Las claves de base de datos, firmas JWT y credenciales de almacenamiento S3 se inyectan estrictamente a través de variables de entorno (`.env`). Nunca se exponen en el repositorio ni en las imágenes de Docker.

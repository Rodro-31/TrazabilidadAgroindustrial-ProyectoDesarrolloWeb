# Guion de Defensa - Proyecto Trazabilidad Agroindustrial

**Fecha de Presentación:** 3 de noviembre de 2026.
**Duración Estimada:** 20 - 25 minutos.

Este guion está estructurado para cubrir estrictamente los 8 puntos evaluables del proyecto, asignando un rol claro a cada integrante del equipo (Víctor, Rodrigo y Owen).

---

## 1. Introducción y Arquitectura (URL Pública y HTTPS) - [Owen]
*   **Owen (Pantalla principal web):** "Buenos días. Presentamos la plataforma de trazabilidad de cardamomo. El sistema está desplegado en producción. Como pueden ver en la barra de direcciones `https://app.x-dev.store`, contamos con conexión segura HTTPS garantizada por Caddy y Let's Encrypt."
*   **Owen:** "La arquitectura es un monolito modular con base de datos PostgreSQL, desplegado en contenedores Docker sobre DigitalOcean. Contamos con una aplicación web para administración y una PWA para campo."

## 2. Login, Control de Permisos y Bloqueo - [Víctor]
*   **Víctor (Pantalla de Login Web):** "La seguridad es propia usando bcrypt y JWT. Para demostrarlo, intentaré ingresar con la cuenta de Auditor ingresando claves incorrectas 5 veces." *(Víctor muestra el mensaje de bloqueo en pantalla)*.
*   **Víctor:** "Ahora ingresaré como Administrador. Aquí puedo ver al usuario bloqueado y generar un enlace de un solo uso para recuperar la contraseña, el cual caduca en 30 minutos, demostrando la gestión segura de tokens."
*   **Víctor:** "Para la demostración principal, ingresaremos con la cuenta del rol `Báscula` en la web y del rol `Campo` en el teléfono móvil."

## 3. PWA Instalada, Recepción y Persistencia Offline - [Víctor & Rodrigo]
*   **Víctor (Compartiendo pantalla del móvil):** "Aquí tengo la PWA instalada en mi teléfono (ícono en pantalla de inicio). Voy a activar el 'Modo Avión'."
*   **Víctor:** "Registro una nueva entrega de cardamomo en la finca. Tomo una foto desde la cámara. Al guardar, el sistema detecta que no hay red y lo deja 'Por enviar' usando IndexedDB."
*   **Víctor:** "Quito el 'Modo Avión'. La PWA sincroniza automáticamente el registro y la foto al servidor."
*   **Rodrigo (En la web como Báscula):** "Confirmando la persistencia real, aquí en el panel web de Recepciones ya puedo ver la entrega de Víctor de hace un segundo, con su foto almacenada en el servidor (volumen persistente de Docker)."

## 4. Trazabilidad: Calidad, Lotes y Procesos - [Rodrigo]
*   **Rodrigo (Web - Módulos de Calidad y Lotes):** "Con la recepción lista, el rol de Calidad registra su inspección (grado Primera). A partir de esta entrega, formamos un nuevo Lote. El sistema genera un código QR sin exponer datos, validable mediante su hash."
*   **Rodrigo:** "En la sección de 'Procesos' dividimos este lote de uva en lotes nuevos; el lote de entrada queda agotado. El sistema controla las existencias mediante reglas transaccionales estrictas que evitan sobregiros."
*   **Rodrigo (Pantalla de Trazabilidad):** "Finalmente, este árbol recursivo nos permite ver que el lote que resultó de la división provino exactamente de la finca y productor que Víctor registró en su teléfono hace unos minutos."

## 5. Auditoría y Logs del Sistema - [Owen]
*   **Owen (Pantalla de Auditoría Web):** "Para cumplir con la regla de oro de la trazabilidad, toda operación sensible (como el bloqueo de intentos de Víctor o una modificación de peso) queda registrada. La auditoría se consulta en esta pantalla: usuario, acción, IP, fecha y los valores Antes/Después."
*   **Owen (Consola):** "A nivel de servidor, los logs de la API muestran el arranque del sistema y los errores. Las operaciones de los usuarios no se ven aquí: se consultan en la pantalla de Auditoría."

## 6. Contenedores, Registry y CI/CD - [Víctor]
*   **Víctor (Terminal del servidor y GitHub):** "Todo esto opera sobre contenedores. Aquí en el servidor DigitalOcean usamos `docker ps` para ver la API, Web, PWA, Caddy y DB corriendo."
*   **Víctor:** "El código está en GitHub. Cada vez que aprobamos un Pull Request a `main`, GitHub Actions corre nuestras pruebas automatizadas (más de 80 pruebas), construye las imágenes Docker y las publica en nuestro registro privado en `ghcr.io`, para finalmente desplegar los cambios al Droplet vía SSH."

## 7. Despliegue de un Cambio en Vivo - [Equipo]
*   **Owen:** "Para finalizar, solicitamos al docente que nos indique un pequeño cambio de texto o color que desee ver en la aplicación."
*   **Víctor:** *(Realiza el cambio en una rama nueva y abre un Pull Request. La rama `main` está protegida: el cambio se aprueba por un compañero y se hace merge a `main`)*.
*   **Rodrigo:** "Al integrarse el cambio a `main`, GitHub Actions ejecuta el pipeline de pruebas, construcción y despliegue. Mientras tanto, abrimos espacio para sus preguntas."
*   **Owen:** *(Al finalizar las preguntas, refresca la página web)* "Como ven, el pipeline ha finalizado y el cambio ya está reflejado en producción de forma automática."

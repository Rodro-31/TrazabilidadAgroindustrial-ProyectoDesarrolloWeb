## Manual de Usuario:
PWA de Trazabilidad en Campo Este documento detalla el uso de la Aplicación Web Progresiva (PWA) diseñada para el registro y consulta de las recepciones de cardamomo en los centros de acopio. Esta herramienta está optimizada para el personal de campo, operadores de báscula y supervisores, permitiendo operar tanto en línea como en zonas rurales con baja conectividad.  
## Acceso e Instalación.

La aplicación está disponible en [https://campo.x-dev.store](https://campo.x-dev.store). Para un rendimiento óptimo, se requiere su instalación en el dispositivo:   Dispositivos móviles: Abre el enlace en el navegador y selecciona "Agregar a pantalla de inicio".   Computadoras de escritorio: Utiliza el navegador Chrome y haz clic en el ícono de instalación ubicado en la barra de direcciones.   


## 1: Inicio de sesión: Para mostrar el acceso con el rol de administrador.
<img width="1920" height="1140" alt="pwa-01-login" src="https://github.com/user-attachments/assets/2499b9b3-8ac0-4469-a07c-2bf8b2c35481" />

## 2: Captura de datos: para evidenciar el cálculo automático del peso neto (100 kg bruto - 2 kg tara = 98 kg neto) y la selección de catálogos. 
<img width="1920" height="1140" alt="pwa-02-nueva-recepcion" src="https://github.com/user-attachments/assets/0248fa6f-9250-428a-a1df-1f0a62e79c75" />

## 3: Repesaje e historial: Para explicar cómo los usuarios con permisos (Admin, Supervisor, Báscula) pueden agregar un nuevo pesaje sin borrar el original.
<img width="1920" height="1140" alt="pwa-04-detalle" src="https://github.com/user-attachments/assets/93baeddb-4e99-4fe0-949b-42921c7a9fd2" />

## 4: Modo sin conexión: Para demostrar visualmente el indicador rojo de "Sin conexión" y cómo las recepciones se almacenan en la sección "Por enviar".
<img width="1920" height="1140" alt="pwa-05-offline" src="https://github.com/user-attachments/assets/b27f3580-3904-41d3-abb0-3263e59437e4" />


## Operación Fuera de Línea (Modo Offline)
La aplicación está diseñada con capacidades offline (Service Workers e IndexedDB) para garantizar la continuidad del trabajo. Si el dispositivo pierde conexión, las recepciones se guardarán localmente bajo la pestaña "Por enviar" y se sincronizarán de forma automática con la base de datos central en cuanto se restablezca la red. 
Consideraciones de Seguridad y CatálogosBloqueo de seguridad: Tras 5 intentos fallidos de inicio de sesión, la cuenta se bloqueará temporalmente para proteger la integridad del sistema.   
Dependencia de datos: La creación de nuevas recepciones requiere que los catálogos (centros de acopio, productores y fincas) hayan sido cargados previamente desde la plataforma administrativa web. 
Si el botón de captura aparece deshabilitado, comuníquese con el administrador del sistema.   

# Pre-entrega 3: autenticación JWT y cookies

Se agregaron JWT con id/email/role y expiración configurable, cookie currentUser HttpOnly/SameSite=Lax de una hora, Secure solo en producción, /current protegido por cookie y logout. Se conserva la autenticación Bearer y la consulta de roles actuales para permisos de tickets.

La suite mostró 30 comprobaciones exitosas: las 26 existentes y cuatro grupos adicionales que cubren registro-login-current-logout-401, errores genéricos de credenciales, ausencia/manipulación/expiración de cookie, duración configurable y Secure en producción. La ejecución dentro del entorno restringido quedó detenida al cerrar los procesos temporales y fue interrumpida; no se obtuvo un cierre global exitoso. El instalador vuelve a ejecutar npm test desde la terminal local para obtener el resultado definitivo.

La integración usa MongoDB temporal y SMTP local, sin los datos o las credenciales reales del proyecto. Cookie es una dependencia ya presente en Express, ahora declarada explícitamente en package.json y package-lock.json.

La copia preparada no modifica por sí sola el proyecto del Escritorio ni GitHub. El instalador comprueba que los archivos originales no hayan cambiado, respalda solo los archivos afectados y conserva .env. No realiza commit ni push.

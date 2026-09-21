# Guía de evaluación — EventHub

Este repositorio es la evolución de las pre-entregas. No requiere frontend ni deploy para ejecutar la API localmente. La colección incluida es opcional; la verificación automatizada completa se ejecuta con `npm test`.

## 1. Instalación y configuración

```powershell
git clone https://github.com/alang26a-eng/proyecto-eventos.git
cd proyecto-eventos
npm ci
Copy-Item .env.example .env
```

No reemplazar un .env ya configurado. Usar Node.js 22 o superior y MongoDB Atlas o un replica set. Completar MONGO_URL y un JWT_SECRET aleatorio de al menos 32 caracteres. JWT_EXPIRES_IN=1h por defecto. Completar MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS y MAIL_FROM con un proveedor SMTP. No hay credenciales incluidas en el repositorio.

```powershell
npm test
npm audit
npm run dev
```

PORT=8080 por defecto; si se usa 8081, ajustar también baseUrl en Postman. Si el puerto está ocupado, detener la instancia anterior o elegir otro. Mantener el servidor abierto durante las pruebas HTTP. Las pruebas automatizadas usan MongoDB temporal y SMTP local, no los datos de Atlas ni destinatarios reales; la primera ejecución puede descargar el binario de MongoDB.

## 2. Usuarios de prueba y roles

Importar `docs/EventHub-final.postman_collection.json` en Postman. Configurar localmente estas variables de la colección:

| Variable | Contenido |
| --- | --- |
| baseUrl | URL del servidor, por ejemplo http://localhost:8081 |
| userEmail | Una casilla propia donde comprobar la confirmación real |
| organizerEmail | Otra dirección para la cuenta organizadora |
| adminEmail | Otra dirección para la cuenta administrativa |
| testPassword | Contraseña NUEVA para estas cuentas de prueba, mínimo 8 caracteres y máximo 72 bytes |

Las tres direcciones deben ser distintas. La contraseña no es la contraseña de Gmail ni la contraseña SMTP. Los campos se distribuyen vacíos para no publicar secretos. Los JWT se guardan localmente al hacer login; no volver a exportar y publicar la colección después de llenarla con credenciales.

Ejecutar la carpeta **1 - Registrar cuentas**. El registro público siempre crea user. Para asignar roles, usar una segunda terminal de confianza en el proyecto:

```powershell
npm run set-role -- CORREO_ORGANIZADOR organizer
npm run set-role -- CORREO_ADMIN admin
```

Reemplazar esos textos por las direcciones elegidas. No hay un endpoint público para promover usuarios. Si el registro responde 409, la cuenta ya existe: usar su contraseña correcta o elegir cuentas nuevas. Si la cuenta elegida como user ya tenía otro rol, asignarle user con la misma herramienta local.

## 3. Ejecutar el flujo

Ejecutar la carpeta **2 - Flujo final** en orden, una sola iteración. Crea eventos nuevos con fecha futura y capacidad 1. Las pruebas de cada request comprueban los códigos HTTP y que no aparezca password.

La colección usa cookies explícitas por rol y `Disable cookie jar` activado por request para evitar mezclar tres sesiones. Si la versión de Postman no respeta la opción importada, activarla manualmente en Settings de cada request antes de ejecutar. Referencia: [administrar cookies en Postman](https://learning.postman.com/docs/use/send-requests/response-data/cookies).

| Paso de la consigna | Evidencia esperada |
| --- | --- |
| Registro, login, current, logout, current | 201, 200 con Set-Cookie HttpOnly, 200, 200 con cookie eliminada, 401 sin cookie |
| user crea evento | 403 |
| organizer crea y user se inscribe | 201 y 201; ticket confirmed, código de reserva y emailStatus=sent |
| Inscripción duplicada | 409 |
| Otra cuenta se inscribe sin cupos | 409 con mensaje de cupos |
| Cancelar ticket y reinscribirse | 200 con cancelledAt; luego 201 |
| organizer modifica evento creado por admin | 403 |
| admin modifica evento del organizer | 200 |
| Respuestas sin password | Comprobación automática en todos los requests |
| Listado paginado | status, data, page=2, limit=5, total y totalPages |

Una segunda página vacía es correcta si hay menos de seis eventos que coincidan. La suite automatizada agrega doce fixtures para verificar también una segunda página con datos, filtros combinados y ordenamiento.

Al inscribirse se envía correo a userEmail; revisar entrada/spam y comparar el código recibido con reservationCode. `sent` significa aceptación SMTP, no certifica por sí solo recepción en casilla. Si no hay SMTP o falla, la reserva igualmente responde 201 confirmed con emailStatus=failed y una notificación explícita. No reintentar la inscripción para reenviar correo. La colección comprueba SMTP configurado, por lo que esa aserción fallará si el evaluador no configuró correo real.

Al terminar se cancela el evento principal; no se borran eventos ni tickets. El evento de prueba del admin permanece. Repetir el recorrido crea nuevos eventos y envía nuevas confirmaciones.

## 4. Evidencia y publicación

Guardar, si se desea, capturas de current 200/401, user 403, evento 201, ticket 201, email recibido, duplicado 409, cancelación, paginación y resultado final de npm test. No incluir tokens, contraseñas ni el contenido de .env. La documentación y la colección no reemplazan verificar los resultados de la terminal.

El entregable principal es el enlace al repositorio público. La consigna recibida considera opcionales la colección y el deploy. Los informes históricos conservan el estado de cada etapa; `verificacion-final.md` se genera solamente cuando el instalador final termina las pruebas y auditoría con éxito.

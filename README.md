# EventHub — Pre-entrega 7
API REST de eventos e inscripciones con registro seguro, login, roles, tickets, control de cupos y confirmaciones por email. Se extiende la entrega 2 con los componentes necesarios para este flujo.

## Tecnologías
Node.js 22+, Express 5, MongoDB/Mongoose, bcrypt, JSON Web Tokens, Nodemailer y dotenv. JavaScript ESM. Pruebas con Node Test Runner, MongoDB temporal real y servidor SMTP local de pruebas.

## Instalación
```powershell
npm ci
Copy-Item .env.example .env
```
Si ya tenés `.env`, conservarlo y agregar las variables faltantes. Nunca subirlo ni compartir su contenido.

| Variable | Uso |
| --- | --- |
| PORT | Puerto HTTP; 8080 por defecto. |
| NODE_ENV | development o production. |
| MONGO_URL | URI privada de Atlas o MongoDB con replica set. |
| JWT_SECRET | Secreto aleatorio de al menos 32 caracteres; obligatorio para login. |
| MAIL_HOST | Servidor SMTP del proveedor. |
| MAIL_PORT | 587 (STARTTLS) o 465 (TLS); el transporte elige TLS directo en 465. |
| MAIL_USER | Usuario SMTP. |
| MAIL_PASS | Contraseña SMTP o contraseña de aplicación del proveedor. |
| MAIL_FROM | Remitente autorizado por el proveedor, por ejemplo EventHub <correo@dominio.com>. |

**MongoDB debe soportar transacciones**: Atlas ya usa replica set. Un MongoDB standalone no alcanza para crear/cancelar tickets. La suite de pruebas levanta su propio replica set y no usa Atlas.

Generar JWT_SECRET y copiar el resultado solo al archivo local `.env`:
```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```
Para correo real, completar las cinco variables MAIL con los datos del proveedor. Gmail requiere una contraseña de aplicación cuando está habilitada para la cuenta, no la contraseña común. Un servicio de pruebas puede capturar los mensajes en su propio panel y no entregarlos a una casilla real.

## Ejecutar
```powershell
npm run dev
```
O `npm start`. La API abre el puerto después de conectar MongoDB e inicializar índices. Ctrl+C detiene el servidor.

## Arquitectura
Ruta → controller → service → repository → DAO → modelo. Validaciones de negocio, permisos sobre recursos y cupos están en services; los controllers solo coordinan HTTP.

```text
src/
  app.js, server.js
  config/             env.config.js, database.js
  routes/             sessions.router.js, events.router.js, tickets.router.js
  controllers/        sessions, auth, events, tickets
  services/           sessions, auth, events, tickets, mail
  repositories/       users, auth, events, tickets
  dao/                users, auth, events, tickets
  models/             User.js, Event.js, Ticket.js
  middlewares/        auth.middleware.js, error.middleware.js
  utils/              hash.js, HttpError.js, objectId.js, token.js
scripts/
  set-role.js
tests/
  register.test.js, tickets.test.js
```

## Registro, login y roles
Registro público: POST /api/sessions/register.
```json
{"first_name":"Ana","last_name":"Pérez","email":"ana@example.com","password":"Secreta123"}
```
Los cuatro campos son obligatorios. Email trim + lowercase y único. Contraseña de 8 caracteres mínimo y hasta 72 bytes UTF-8, protegida con bcrypt. El registro siempre asigna user e ignora role del body. Respuesta 201 sin password; 400 para datos inválidos; 409 para duplicados.

Login: POST /api/sessions/login.
```json
{"email":"ana@example.com","password":"Secreta123"}
```
Respuesta 200: `{"status":"success","payload":{"token":"TOKEN","user":{...}}}`.
Credenciales incorrectas: 401. Usar en las rutas protegidas:
```text
Authorization: Bearer TOKEN
```
JWT HS256 con expiración de una hora, emisor y audiencia fijos. El middleware consulta el usuario y su rol actual en MongoDB: no acepta roles enviados en headers/body. No hay un endpoint público para convertirse en admin.

Para preparar una cuenta organizadora de prueba, registrarla primero. Luego, **solo desde una terminal de confianza con acceso a la base**, ejecutar:
```powershell
npm run set-role -- correo-del-organizador@example.com organizer
```
El mismo comando acepta user y admin. Cambia roles en la base configurada en MONGO_URL; no usar cuentas ajenas.

## Eventos
GET /api/events devuelve los eventos published.
POST /api/events requiere organizer o admin:
```json
{
  "title":"Encuentro Backend",
  "description":"Práctica de APIs",
  "date":"2030-12-20T18:00:00.000Z",
  "endDate":"2030-12-20T21:00:00.000Z",
  "location":"Auditorio",
  "capacity":2,
  "status":"published"
}
```
La fecha debe ser futura; adaptar el ejemplo si es necesario. El organizador es siempre el usuario autenticado, aunque el body intente cambiarlo. Capacidad entera positiva. El modelo soporta draft, published, cancelled y finished; creación acepta draft o published. Para las pruebas manuales de estados, preparar fixtures cambiando status de eventos de prueba desde Atlas. No se implementa en esta entrega un CRUD completo de eventos.

## Rutas de tickets
| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | /api/events/:eid/tickets | Autenticado. |
| GET | /api/tickets/my-tickets | Autenticado; solo propios. |
| GET | /api/events/:eid/tickets | Organizador del evento o admin. |
| PATCH | /api/tickets/:tid/cancel | Dueño del ticket o admin. |

Inscripción:
```json
{"quantity":2}
```
Respuesta 201:
```json
{
  "status":"success",
  "payload":{
    "_id":"ID_TICKET",
    "user":"ID_USUARIO",
    "event":"ID_EVENTO",
    "status":"confirmed",
    "quantity":2,
    "reservationCode":"UUID_GENERADO",
    "createdAt":"FECHA_ISO",
    "cancelledAt":null,
    "emailStatus":"sent"
  },
  "notification":"Confirmación aceptada por el servidor de correo"
}
```
Puede incluir metadatos de Mongoose. user y event se guardan como referencias ObjectId, nunca como objetos embebidos. Código de reserva UUID con índice único.

### Estados y cupos
- confirmed: inscripción confirmada, ocupa quantity cupos.
- pending: reserva pendiente, también ocupa quantity cupos. Se soporta en el modelo; el endpoint público crea confirmed.
- cancelled: no ocupa cupos; conserva el documento y cancelledAt.

Se permite **una sola inscripción activa por usuario/evento**. Al cancelar se permite una inscripción nueva con otro código. El índice único parcial refuerza esta regla.

Cupos disponibles = capacity menos la suma de quantity de tickets confirmed/pending. Se valida que el evento exista, esté published y que su endDate (o date cuando no hay endDate) sea futura. quantity debe ser un número entero seguro mayor que cero, no un string.

Crear y cancelar tickets usan transacciones. Primero se incrementa bookingVersion del evento dentro de la transacción: solicitudes concurrentes que comparten evento generan conflicto y reintento con una nueva vista de los cupos. Luego se calcula la suma y se inserta/cancela el ticket. No hay contador de cupos duplicado que pueda quedar desactualizado.

Cancelación cambia status y cancelledAt, sin borrar el documento. Cancelar dos veces devuelve 409. Los cupos quedan libres por excluir cancelled del cálculo.

Mis tickets incluye event mediante populate limitado a title, date y location. La consulta de organizadores devuelve referencias a usuarios sin contraseñas ni correos de otros usuarios.

### Email
Después de confirmar la transacción, Nodemailer envía el mensaje a la dirección del usuario autenticado con evento, fecha, ubicación, cantidad y código. El destinatario no puede elegirse desde el body.

emailStatus es independiente del estado del ticket:
- sent: el servidor SMTP aceptó el mensaje; comprobar recepción en bandeja de entrada/spam.
- failed: el envío falló o SMTP no está configurado. La reserva sigue confirmed; la respuesta lo informa.
- pending: todavía no se pudo registrar/verificar el resultado.

El correo se envía fuera de la transacción para evitar envíos repetidos por reintentos de MongoDB. No se implementa una cola automática de reenvío: si falla, conservar el código y corregir SMTP; no repetir la inscripción para intentar recuperar el correo. Un cierre abrupto después del commit puede dejar emailStatus pending.

### Errores
Todos usan `{"status":"error","message":"..."}`.
400: quantity/identificadores/datos inválidos.
401: sesión ausente, inválida o vencida.
403: ticket ajeno, rol insuficiente u organizador de otro evento.
404: evento/ticket inexistente.
409: evento no disponible, sin cupo, duplicado activo o ticket ya cancelado.
500: error interno sin credenciales ni detalles privados.

## Flujo manual en Postman
1. Configurar Atlas, JWT_SECRET y SMTP; iniciar el servidor.
2. Registrar dos usuarios con direcciones de prueba propias y un organizador.
3. Asignar organizer con el comando local y hacer login; guardar el token.
4. Crear un evento publicado de capacidad 2 con el token del organizador; guardar _id.
5. Hacer login con el usuario y crear un ticket quantity 2; verificar 201 y email recibido.
6. Repetir inscripción con el mismo usuario: 409. Probar otro usuario sin cupos: 409.
7. Sin Authorization: 401. Evento inexistente: 404. Evento cancelled/finished o pasado: 409.
8. Cancelar como otro user: 403. Cancelar como dueño: 200 y cancelledAt.
9. Crear inscripción nuevamente por los cupos liberados: 201.
10. Consultar inscripciones del evento como user: 403; organizador ajeno: 403; dueño/admin: 200.
11. Consultar my-tickets: solo propios con title, date y location.
12. Capturar respuesta del ticket, ticket guardado en Atlas y correo recibido, sin tokens ni credenciales.

## Pruebas automatizadas
```powershell
npm test
```
La suite usa una base temporal con replica set para transacciones y un servidor SMTP en localhost que realmente recibe el mensaje enviado por Nodemailer. Nunca usa Atlas ni envía a personas reales. La primera ejecución requiere internet para descargar MongoDB.

Incluye los diez casos exigidos, comprobación de email SMTP, manipulación de roles/propietario, cantidad inválida, referencias, populate, cupos concurrentes, duplicado concurrente, pending, fallo SMTP y regresión del registro seguro. La recepción en una casilla externa debe verificarse aparte con el proveedor configurado.

## Entrega y credenciales
Subir package.json, package-lock.json, .env.example, .gitignore, README, src, scripts y tests. No subir .env, node_modules, tokens ni credenciales. La captura docs/registro-mongodb.png corresponde a la entrega 2; adjuntar nuevas capturas del flujo de tickets y correo para esta entrega.

Referencias: [transacciones de Mongoose](https://mongoosejs.com/docs/transactions.html), [índices parciales de MongoDB](https://www.mongodb.com/docs/manual/core/index-partial/), [SMTP de Nodemailer](https://nodemailer.com/smtp).

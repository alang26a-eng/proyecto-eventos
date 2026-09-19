# EventHub — Pre-entregas 3, 4 y 7
API REST de eventos e inscripciones con registro seguro, login, roles, tickets, control de cupos y confirmaciones por email. Se extiende la entrega 2 con los componentes necesarios para este flujo.

## Tecnologías
Node.js 22+, Express 5, MongoDB/Mongoose, bcrypt, Passport, passport-custom, JSON Web Tokens, Nodemailer y dotenv. JavaScript ESM. Pruebas con Node Test Runner, MongoDB temporal real y servidor SMTP local de pruebas.

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
  config/             env.config.js, database.js, passport.config.js
  routes/             sessions.router.js, events.router.js, tickets.router.js
  controllers/        sessions, auth, events, tickets
  services/           events, tickets, mail
  repositories/       users, auth, events, tickets
  dao/                users, auth, events, tickets
  models/             User.js, Event.js, Ticket.js
  middlewares/        auth.middleware.js, error.middleware.js
  utils/              hash.js, HttpError.js, objectId.js, jwt.js, token.js
scripts/
  set-role.js
tests/
  register.test.js, tickets.test.js
```

## Registro, login y roles
### Pre-entrega 4: autenticación centralizada con Passport

`src/config/passport.config.js` registra las estrategias de Passport mediante `passport-custom`. Se eligieron callbacks con acceso al request para conservar exactamente las validaciones, códigos HTTP y respuestas JSON existentes, incluso ante campos ausentes o de tipos incorrectos. `app.js` únicamente importa la configuración y ejecuta `passport.initialize()`. No se usan sesiones de servidor: todos los middleware declaran `session: false`.

- **register:** valida los campos, normaliza email, aplica bcrypt, controla unicidad (incluidas altas simultáneas) y fuerza role=user. El usuario público queda en req.user sin password.
- **login:** valida credenciales y devuelve un usuario sin password; no firma JWT ni modifica cookies. El controller de autenticación firma el JWT y establece currentUser. El mensaje de credenciales inválidas sigue siendo genérico.
- **current:** extrae el JWT de la cookie currentUser, valida firma y expiración con utils/jwt.js y deja id/email/role en req.user. Sin token válido responde 401 JSON.
- **access:** centraliza la autenticación de eventos y tickets, conserva cookie/Bearer y consulta el usuario y rol actual en MongoDB para mantener los permisos existentes.

Las rutas de registro, login y current delegan directamente en `passport.authenticate`. Logout elimina la cookie sin pasar por Passport. Se retiraron los services de autenticación y registro anteriores para evitar tener lógica duplicada. Los services de eventos y tickets conservan sus validaciones de negocio.

El contrato externo se mantiene, incluido payload.token del login para los clientes existentes de tickets. JWT_EXPIRES_IN, JWT_SECRET y los atributos de cookie siguen iguales. No se requieren nuevas variables de entorno para estas estrategias.

El sistema queda preparado para registrar providers externos como Google o GitHub en passport.config.js sin modificar app.js. Todavía no están implementados: requerirían credenciales del proveedor y rutas de autorización/callback.

Ejecutar `npm ci`, `npm test` y `npm audit`. Las pruebas existentes cubren registro-login-current-logout-401, email duplicado, credenciales inválidas, cookies manipuladas/vencidas y regresión de tickets. Se agregó un caso de acceso a tickets mediante cookie a través de Passport.

Referencia: [estrategias de Passport](https://www.passportjs.org/concepts/authentication/strategies/).

### Pre-entrega 3: sesión con cookie

JWT_EXPIRES_IN configura la duración del JWT, por ejemplo `1h` o `30m`; por defecto es `1h`. JWT_SECRET se guarda solamente en el entorno. La firma y verificación están en `src/utils/jwt.js`; bcrypt permanece en `src/utils/hash.js`.

Login genera un JWT con `id`, `email` y `role`, además de claims estándar de expiración, emisor, audiencia y subject. Nunca incluye password. Guarda el token en la cookie `currentUser` con HttpOnly, SameSite=Lax, Path=/ y Max-Age=3600 segundos. Secure se activa solo con NODE_ENV=production, donde se requiere HTTPS. La cookie dura una hora aunque se configure otra duración del token; un JWT vencido se rechaza igualmente.

`GET /api/sessions/current` requiere esa cookie, verifica la firma y expiración y coloca el payload en req.user. Devuelve únicamente id, email y role. El rol devuelto es el firmado al iniciar sesión; para autorizar acciones sobre eventos y tickets se consulta el rol actual en MongoDB.

Logout elimina la cookie con los mismos atributos. Un navegador que procese esa respuesta deja de enviarla y /current responde 401. No existe una lista de revocación: una copia del JWT sigue siendo válida hasta su vencimiento. Para conservar compatibilidad con los clientes de tickets, login también devuelve payload.token y payload.user y las rutas de tickets/eventos siguen aceptando Bearer; /current exige cookie.

| Método y ruta | Descripción / request | Respuesta de ejemplo |
| --- | --- | --- |
| POST /api/sessions/register | `{"first_name":"Ana","last_name":"Perez","email":"ana@example.com","password":"Prueba123"}` | 201 `{"status":"success","payload":{"id":"ID","first_name":"Ana","last_name":"Perez","email":"ana@example.com","role":"user"}}` |
| POST /api/sessions/login | `{"email":"ana@example.com","password":"Prueba123"}` | 200 `{"status":"success","message":"Login correcto","payload":{"token":"JWT","user":{"id":"ID","first_name":"Ana","last_name":"Perez","email":"ana@example.com","role":"user"}}}` y Set-Cookie currentUser |
| GET /api/sessions/current | Sin body; enviar cookie currentUser | 200 `{"status":"success","payload":{"id":"ID","email":"ana@example.com","role":"user"}}` |
| POST /api/sessions/logout | Sin body | 200 `{"status":"success","message":"Sesión cerrada"}` y eliminación de cookie |
| GET /api/health | Sin body | 200 `{"status":"ok","message":"Servidor activo"}` |
| GET /api/sessions | Sin body; estado del recurso | 200, mensaje de estado del recurso sessions |
| GET /api/events | Sin body; eventos publicados | 200 `[]` si no existen eventos |
| POST /api/events | Organizador/admin; ejemplo completo debajo | 201 `{"status":"success","payload":{"_id":"EVENTO","title":"Encuentro Backend","status":"published"}}` (extracto) |
| POST /api/events/:eid/tickets | Autenticado, `{"quantity":1}` | 201 `{"status":"success","payload":{"status":"confirmed","reservationCode":"UUID"},"notification":"Confirmación aceptada por el servidor de correo"}` (extracto) |
| GET /api/tickets/my-tickets | Autenticado; sin body | 200 `{"status":"success","payload":[]}` si no tiene tickets |
| GET /api/events/:eid/tickets | Dueño del evento/admin; sin body | 200 `{"status":"success","payload":[]}` si no hay inscripciones |
| PATCH /api/tickets/:tid/cancel | Dueño del ticket/admin; sin body | 200 `{"status":"success","payload":{"status":"cancelled","cancelledAt":"FECHA"}}` (extracto) |

Email inexistente y contraseña incorrecta devuelven el mismo 401: `{"status":"error","message":"Credenciales inválidas"}`. Campos ausentes en login devuelven 400. /current sin cookie o con JWT manipulado/vencido devuelve 401: `{"status":"error","message":"No autenticado"}`.

Para comprobarlo desde PowerShell, usar `Invoke-RestMethod` con `-SessionVariable navegador` al hacer login y `-WebSession $navegador` al consultar /current y ejecutar logout. Después del logout, repetir /current con la misma sesión debe dar 401. No imprimir ni publicar el token o la cookie.

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
JWT HS256 con expiración configurable mediante JWT_EXPIRES_IN (1h por defecto), emisor y audiencia fijos. El middleware consulta el usuario y su rol actual en MongoDB: no acepta roles enviados en headers/body. No hay un endpoint público para convertirse en admin.

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

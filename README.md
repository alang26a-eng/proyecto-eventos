# EventHub — Pre-entrega 2 de Backend II

API REST para una plataforma de eventos e inscripciones. Esta entrega agrega registro seguro de usuarios con MongoDB, conservando health, events y la arquitectura inicial.

## Tecnologías y requisitos

Node.js 22 o superior, npm, Express 5, dotenv, Mongoose, bcrypt y nodemon. JavaScript ESM (import/export). MongoDB local o un clúster de MongoDB Atlas. Las pruebas usan Node Test Runner y mongodb-memory-server con una base temporal independiente.

## Instalación y configuración

Desde la carpeta del proyecto:

```powershell
npm install
Copy-Item .env.example .env
```

Editar `.env` localmente. No compartirlo ni subirlo a GitHub.

| Variable | Uso |
| --- | --- |
| PORT | Puerto HTTP, 8080 por defecto. |
| NODE_ENV | development para desarrollo. |
| MONGO_URL | URI privada de MongoDB, obligatoria para iniciar. |
| JWT_SECRET | Reservada para futuras entregas; todavía no se usa. |

Para MongoDB local: `mongodb://127.0.0.1:27017/eventhub`.

Para Atlas: copiar la URI desde la conexión para drivers del clúster y colocarla como MONGO_URL en `.env`, con el usuario y contraseña de BASE DE DATOS y la base `eventhub`. Ejemplo ilustrativo: `mongodb+srv://USUARIO:CLAVE@TU-CLUSTER.mongodb.net/eventhub?retryWrites=true&w=majority`. Reemplazar los marcadores solo en el archivo privado. Los caracteres especiales de la contraseña deben codificarse para una URL. Autorizar la IP de la computadora en Atlas y dar al usuario de base permisos de lectura/escritura sobre eventhub.

## Ejecutar

```powershell
npm run dev
```

O `npm start`. El servidor primero conecta con MongoDB y crea el índice único de email; recién entonces abre el puerto HTTP. Si falla, revisar URI, disponibilidad, usuario y acceso de red. Ctrl+C detiene el servidor.

## Arquitectura

```text
src/
  app.js
  server.js
  config/
    env.config.js
    database.js
  routes/
    events.router.js
    sessions.router.js
  controllers/
    events.controller.js
    sessions.controller.js
  services/
    sessions.service.js
  repositories/
    users.repository.js
  dao/
    users.dao.js
  models/
    User.js
    Event.js
  middlewares/
    error.middleware.js
  utils/
    hash.js
    HttpError.js
tests/
  register.test.js
```

Flujo: ruta → controller → service → repository → DAO → modelo Mongoose. El service valida datos, normaliza email, verifica duplicados y llama al helper reutilizable de bcrypt. El repository separa negocio de acceso a datos. El DAO usa Mongoose. El controller define la respuesta HTTP. Express 5 deriva errores asíncronos al middleware de errores.

User tiene first_name, last_name, email, password y role; roles permitidos user, organizer y admin, con user por defecto. Event conserva el modelo base de la primera entrega.

## Rutas

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | /api/health | 200, servidor activo. |
| GET | /api/events | 200, lista vacía. |
| GET | /api/sessions | 200, información sobre sesiones. |
| POST | /api/sessions/register | 201, usuario creado. |

Login, JWT, cookies y autorización quedan para próximas entregas.

## Probar el registro

En Postman usar POST a `http://localhost:8080/api/sessions/register`, seleccionar Body → raw → JSON y enviar:

```json
{
  "first_name": "Ana",
  "last_name": "Pérez",
  "email": "Ana@Mail.com ",
  "password": "Secreta123"
}
```

Los cuatro campos son obligatorios y deben ser strings no vacíos. Los nombres se guardan sin espacios exteriores. El email se valida y normaliza con trim + lowercase. La contraseña debe tener al menos 8 caracteres y hasta 72 bytes UTF-8 (límite de bcrypt); se conserva sin trim. El registro ignora role y otros campos adicionales: siempre crea un usuario con rol user.

Respuesta HTTP 201:

```json
{
  "status": "success",
  "payload": {
    "id": "ID_GENERADO_POR_MONGODB",
    "first_name": "Ana",
    "last_name": "Pérez",
    "email": "ana@mail.com",
    "role": "user"
  }
}
```

También se puede probar en una segunda terminal PowerShell con el servidor funcionando:

```powershell
$body = @{
  first_name = "Ana"
  last_name = "Perez"
  email = "Ana@Mail.com "
  password = "Secreta123"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/sessions/register" -ContentType "application/json; charset=utf-8" -Body $body
```

| Caso | HTTP | Resultado esperado |
| --- | --- | --- |
| Registro válido con email nuevo | 201 | Usuario sin password. |
| Falta un campo o tiene tipo incorrecto | 400 | Faltan campos obligatorios. |
| Email inválido | 400 | El email tiene un formato inválido. |
| Contraseña menor a 8 caracteres | 400 | La contraseña debe tener al menos 8 caracteres. |
| Contraseña mayor a 72 bytes | 400 | La contraseña no puede superar 72 bytes. |
| Email ya registrado, incluso con mayúsculas o espacios | 409 | El email ya está registrado. |
| Body con role: admin | 201 | Se registra como user. |
| JSON malformado | 400 | El cuerpo debe ser un JSON válido. |

Los errores devuelven `{"status":"error","message":"..."}`. El índice único protege también ante solicitudes simultáneas. Los errores internos no exponen contraseñas, URI ni detalles de MongoDB.

## Verificar persistencia y adjuntar evidencia

Luego del registro en Atlas, abrir la colección `eventhub.users` y buscar `{ "email": "ana@mail.com" }`. Deben aparecer el usuario, role user y un password con hash bcrypt que empieza con `$2b$12$`, nunca Secreta123. La respuesta HTTP no contiene password, ni siquiera hasheada.

Adjuntar una captura de la respuesta 201 y otra del documento en MongoDB usando un usuario de prueba. No incluir la URI privada ni credenciales en las capturas.

## Pruebas automáticas

```powershell
npm test
```

Las pruebas levantan un proceso real de MongoDB temporal con mongodb-memory-server, prueban HTTP y revisan los documentos guardados. No usan MONGO_URL, no conectan a Atlas ni tocan usuarios reales. La primera ejecución descarga el binario de MongoDB y requiere acceso a internet. La base temporal se elimina al finalizar.

Cubren registro, normalización, bcrypt y comparación, exclusión de password, rol forzado, campos faltantes/tipos, email inválido, longitud de contraseña, duplicados (incluidos simultáneos), JSON inválido y rutas de la entrega anterior.

## Entrega

Subir el código, package.json, package-lock.json, README.md y .env.example al repositorio público. .gitignore excluye .env, node_modules y archivos de log. No subir credenciales. Los .gitkeep conservan la estructura de carpetas de la primera entrega.

Referencias técnicas: [Mongoose: índices únicos y validación](https://mongoosejs.com/docs/validation.html#the-unique-option-is-not-a-validator) y [bcrypt: límite de 72 bytes](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns).


## Evidencia del registro en Atlas

![Usuario de prueba persistido con email normalizado, rol user y hash bcrypt](docs/registro-mongodb.png)


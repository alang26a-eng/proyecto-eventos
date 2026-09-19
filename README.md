# EventHub

Pre-entrega 1 de Backend II: estructura inicial de una API REST organizada por capas.

## Temática

Plataforma de eventos e inscripciones, destinada a publicar eventos y gestionar sus participantes en futuras entregas. Esta primera etapa incluye un servidor funcional, consulta de eventos vacía y estructura inicial de sesiones sin autenticación.

## Tecnologías

- Node.js y npm.
- Express para el servidor HTTP y sus rutas.
- dotenv para las variables de entorno.
- nodemon para reiniciar el servidor durante el desarrollo.
- JavaScript con módulos ESM (`import` / `export`).

## Instalación

Requisito: Node.js 22 o superior con npm.

Descargar o clonar este repositorio, abrir una terminal dentro de la carpeta que contiene `package.json` y ejecutar:

```sh
npm ci
```

## Configuración

Copiar `.env.example` como `.env` en la raíz del proyecto.

En PowerShell (Windows):

```powershell
Copy-Item .env.example .env
```

En Linux/macOS:

```sh
cp .env.example .env
```

| Variable | Ejemplo | Uso |
| --- | --- | --- |
| PORT | 8080 | Puerto HTTP; por defecto, 8080. |
| NODE_ENV | development | Entorno de ejecución. |
| MONGO_URL | mongodb://127.0.0.1:27017/eventhub | Preparada para persistencia futura. |
| JWT_SECRET | reemplazar_por_un_secreto_local | Preparada para autenticación futura. |

MongoDB y JWT no están implementados en esta entrega. No hace falta instalar MongoDB para ejecutar el servidor. El valor de JWT_SECRET del ejemplo es un marcador: reemplazarlo por un secreto local antes de implementar autenticación. `.env` y `node_modules/` están excluidos de Git. No publicar credenciales.

## Ejecución

Desarrollo, con reinicio automático:

```sh
npm run dev
```

Ejecución normal:

```sh
npm start
```

Con la configuración de ejemplo, el servidor queda disponible en `http://localhost:8080`. Detenerlo con Ctrl+C. También funciona sin `.env`, usando el puerto predeterminado.

## Estructura de carpetas

```text
proyecto-eventos/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── env.config.js
│   ├── routes/
│   │   ├── events.router.js
│   │   └── sessions.router.js
│   ├── controllers/
│   │   ├── events.controller.js
│   │   └── sessions.controller.js
│   ├── services/
│   │   └── .gitkeep
│   ├── repositories/
│   │   └── .gitkeep
│   ├── dao/
│   │   └── .gitkeep
│   ├── models/
│   │   ├── User.js
│   │   └── Event.js
│   ├── middlewares/
│   │   └── .gitkeep
│   └── utils/
│       └── .gitkeep
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

`app.js` configura Express, `express.json()` y las rutas, sin abrir un puerto. `server.js` carga la configuración y levanta el servidor. Las rutas delegan en controladores propios.

Las carpetas `services` (reglas de negocio), `repositories` (abstracción de persistencia), `dao` (acceso a datos), `middlewares` y `utils` quedan preparadas para próximas entregas. Sus archivos `.gitkeep` permiten que Git conserve las carpetas vacías.

`User` y `Event` son clases base, sin conexión a base de datos ni validaciones de negocio. User define identificador, nombre, apellido, correo, hash de contraseña y rol. Event define identificador, título, descripción, fecha, ubicación, capacidad e identificador del organizador.

## Rutas disponibles

| Método | Ruta | Estado HTTP | Respuesta |
| --- | --- | --- | --- |
| GET | /api/health | 200 | `{"status":"ok","message":"Servidor activo"}` |
| GET | /api/events | 200 | `[]` |
| GET | /api/sessions | 200 | `{"status":"pending","message":"Estructura de sesiones preparada. Autenticación pendiente."}` |

Las rutas inexistentes devuelven HTTP 404 con un mensaje JSON. La ruta de sesiones es informativa: no inicia sesiones ni implementa login, registro o JWT.

## Verificación manual

Con el servidor activo, abrir en el navegador `http://localhost:8080/api/health` y `http://localhost:8080/api/events`, o usar otra terminal PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-WebRequest http://localhost:8080/api/events | Select-Object StatusCode, Content
```

Ambas rutas deben responder HTTP 200. Health indica que el servidor está activo y events devuelve una lista vacía. Si se modifica PORT, adaptar las direcciones.

## Entrega en GitHub

Crear un repositorio público y subir los archivos del proyecto, incluyendo `package-lock.json`, `.env.example` y los `.gitkeep`. Antes de confirmar los cambios, revisar `git status` para comprobar que no se incluyan `.env`, credenciales ni `node_modules/`. Entregar el enlace del repositorio público.

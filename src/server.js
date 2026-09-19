import { config } from './config/env.config.js';
import app from './app.js';

const server = app.listen(config.port, () => {
  console.log(`EventHub activo en http://localhost:${config.port}`);
});

server.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor: ${error.message}`);
  process.exitCode = 1;
});

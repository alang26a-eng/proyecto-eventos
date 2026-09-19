import mongoose from 'mongoose';
import { config } from './config/env.config.js';
import { connectDatabase } from './config/database.js';
import app from './app.js';

try {
  await connectDatabase(config.mongoUrl);
  console.log('MongoDB conectado');
  const server = app.listen(config.port, () => {
    console.log(`EventHub activo en http://localhost:${config.port}`);
  });
  server.on('error', async () => {
    console.error('No se pudo iniciar HTTP. Verificá que PORT esté disponible.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => { await mongoose.disconnect(); });
    });
  }
} catch (error) {
  // No imprimir el error completo: puede contener credenciales.
  const code = error.code ?? error.cause?.code;
  if (code === 18 || /authentication failed|bad auth/i.test(error.message)) {
    console.error('AUTENTICACION: revisá el usuario de base de datos y su contraseña en Atlas.');
  } else if (error.name === 'MongoParseError') {
    console.error('FORMATO: revisá la URI y los caracteres especiales de la contraseña.');
  } else if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code) || /querySrv/i.test(error.message)) {
    console.error('DNS: revisá el nombre del clúster y la conexión a internet.');
  } else if (/ServerSelectionError/.test(error.name)) {
    console.error('RED: revisá que Atlas permita tu IP actual, que el clúster esté activo y que la red permita la conexión.');
  } else if (code === 11000) {
    console.error('INDICE: existen emails duplicados en la colección de usuarios.');
  } else if (!config.mongoUrl) {
    console.error('CONFIGURACION: falta MONGO_URL en .env.');
  } else {
    console.error('CONEXION: revisá permisos del usuario de base de datos y configuración del clúster.');
  }
  await mongoose.disconnect();
  process.exitCode = 1;
}




import mongoose from 'mongoose';
import { config } from '../src/config/env.config.js';
import { connectDatabase } from '../src/config/database.js';
import User from '../src/models/User.js';

const [email, role] = process.argv.slice(2);
try {
  if (!email || !['user', 'organizer', 'admin'].includes(role)) {
    throw new Error('Uso: npm run set-role -- email user|organizer|admin');
  }
  await connectDatabase(config.mongoUrl);
  const user = await User.findOneAndUpdate({ email: email.trim().toLowerCase() },
    { $set: { role } }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new Error('El usuario debe registrarse primero');
  console.log('Rol actualizado a ' + user.role);
} catch {
  console.error('No se pudo cambiar el rol. Revisá email, rol, MONGO_URL y conectividad.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }

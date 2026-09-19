import passport from 'passport';
import { Strategy } from 'passport-custom';
import cookie from 'cookie';
import * as usersRepository from '../repositories/users.repository.js';
import * as authRepository from '../repositories/auth.repository.js';
import { findIdentity } from '../repositories/auth.repository.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { verifyToken } from '../utils/jwt.js';
import HttpError from '../utils/HttpError.js';

// Conserva errores HTTP/JSON y propaga fallos async a Express.
const strategy = verify => new Strategy((req, done) => {
  Promise.resolve().then(() => verify(req)).then(user => done(null, user), done);
});

passport.use('register', strategy(async req => {
  const { first_name, last_name, email, password } = req.body ?? {};
  if ([first_name, last_name, email, password].some(value => typeof value !== 'string' || !value.trim())) {
    throw new HttpError(400, 'Faltan campos obligatorios');
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new HttpError(400, 'El email tiene un formato inválido');
  }
  if ([...password].length < 8) {
    throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres');
  }
  // bcrypt admite hasta 72 bytes; rechazar para evitar truncamiento silencioso.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new HttpError(400, 'La contraseña no puede superar 72 bytes');
  }
  if (await usersRepository.findByEmail(normalizedEmail)) {
    throw new HttpError(409, 'El email ya está registrado');
  }
  const hashedPassword = await hashPassword(password);
  let user;
  try {
    // Lista explícita: el cliente no puede elegir rol, id ni hash.
    user = await usersRepository.createUser({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
    });
  } catch (error) {
    // El índice único cubre también solicitudes simultáneas.
    if (error.code === 11000) throw new HttpError(409, 'El email ya está registrado');
    throw error;
  }
  return {
    id: user._id.toString(),
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
  };
}));

passport.use('login', strategy(async req => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email y contraseña son obligatorios');
  }
  const user = await authRepository.findCredentials(email.trim().toLowerCase());
  if (!user || !(await comparePassword(password, user.password))) {
    throw new HttpError(401, 'Credenciales inválidas');
  }
  return {
    id: user._id.toString(), first_name: user.first_name, last_name: user.last_name,
    email: user.email, role: user.role,
  };
}));

passport.use('current', strategy(req => {
  try {
    const token = cookie.parse(req.headers.cookie || '').currentUser;
    if (!token) throw new Error('missing');
    const payload = verifyToken(token);
    if (!/^[a-f\d]{24}$/i.test(payload.id || '') || typeof payload.email !== 'string' || !['user', 'organizer', 'admin'].includes(payload.role)) throw new Error('payload');
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    throw new HttpError(401, 'No autenticado');
  }

}));

// Cookie o Bearer para tickets; consulta el rol vigente en MongoDB.
passport.use('access', strategy(async req => {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  const token = match?.[1] || (!header && cookie.parse(req.headers.cookie || '').currentUser);
  if (!token) throw new HttpError(401, 'No autenticado');
  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'No autenticado');
  }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) {
    throw new HttpError(401, 'No autenticado');
  }
  // Rol actual de la base: no se confía en roles del token, body ni headers.
  const user = await findIdentity(payload.sub);
  if (!user) throw new HttpError(401, 'No autenticado');
  return user;

}));

// Agregar futuros providers aquí mediante passport.use, sin modificar app.js.
export default passport;

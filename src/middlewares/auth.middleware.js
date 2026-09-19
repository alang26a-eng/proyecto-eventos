import { verifyToken } from '../utils/jwt.js';
import cookie from 'cookie';
import { findIdentity } from '../repositories/auth.repository.js';
import HttpError from '../utils/HttpError.js';

// /current exige cookie; Bearer se mantiene para clientes existentes de tickets.
export function authenticateCookie(req, res, next) {
  try {
    const token = cookie.parse(req.headers.cookie || '').currentUser;
    if (!token) throw new Error('missing');
    const payload = verifyToken(token);
    if (!/^[a-f\d]{24}$/i.test(payload.id || '') || typeof payload.email !== 'string' || !['user', 'organizer', 'admin'].includes(payload.role)) throw new Error('payload');
    req.user = payload;
  } catch {
    throw new HttpError(401, 'No autenticado');
  }
  next();
}

export async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  const token = match?.[1] || (!header && cookie.parse(req.headers.cookie || '').currentUser);
  if (!token) throw new HttpError(401, 'Debés iniciar sesión');
  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, 'Sesión inválida o vencida');
  }
  if (typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) {
    throw new HttpError(401, 'Sesión inválida');
  }
  // Rol actual de la base: no se confía en roles del token, body ni headers.
  const user = await findIdentity(payload.sub);
  if (!user) throw new HttpError(401, 'Sesión inválida');
  req.user = user;
  next();
}

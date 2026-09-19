import { verifyToken } from '../utils/token.js';
import { findIdentity } from '../repositories/auth.repository.js';
import HttpError from '../utils/HttpError.js';

export async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'Debés iniciar sesión');
  let payload;
  try {
    payload = verifyToken(match[1]);
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

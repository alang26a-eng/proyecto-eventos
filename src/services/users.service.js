import * as users from '../repositories/users.repository.js';
import HttpError from '../utils/HttpError.js';
// Solo para la herramienta administrativa local; no existe ruta pública de promoción.
export async function setUserRole(email, role) {
  if (typeof email !== 'string' || !email.trim() || !['user', 'organizer', 'admin'].includes(role)) throw new HttpError(400, 'Email o rol inválido');
  const user = await users.setRole(email.trim().toLowerCase(), role);
  if (!user) throw new HttpError(404, 'El usuario no existe');
  return user;
}
export async function listUsers(query) {
  const rawPage = query.page ?? '1';
  const rawLimit = query.limit ?? '20';
  if (typeof rawPage !== 'string' || typeof rawLimit !== 'string' || !/^[1-9]\d*$/.test(rawPage) || !/^[1-9]\d*$/.test(rawLimit)) throw new HttpError(400, 'Paginación inválida');
  const page = Number(rawPage), limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * limit) || limit > 100) throw new HttpError(400, 'Paginación inválida');
  const [payload, total] = await Promise.all([users.listPublic((page - 1) * limit, limit), users.countUsers()]);
  return { payload, pagination: { page, limit, total } };
}

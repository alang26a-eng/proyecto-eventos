import * as users from '../repositories/users.repository.js';
import HttpError from '../utils/HttpError.js';
export async function listUsers(query) {
  const rawPage = query.page ?? '1';
  const rawLimit = query.limit ?? '20';
  if (typeof rawPage !== 'string' || typeof rawLimit !== 'string' || !/^[1-9]\d*$/.test(rawPage) || !/^[1-9]\d*$/.test(rawLimit)) throw new HttpError(400, 'Paginación inválida');
  const page = Number(rawPage), limit = Number(rawLimit);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger((page - 1) * limit) || limit > 100) throw new HttpError(400, 'Paginación inválida');
  const [payload, total] = await Promise.all([users.listPublic((page - 1) * limit, limit), users.countUsers()]);
  return { payload, pagination: { page, limit, total } };
}

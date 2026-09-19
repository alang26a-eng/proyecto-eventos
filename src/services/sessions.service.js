import * as usersRepository from '../repositories/users.repository.js';
import { hashPassword } from '../utils/hash.js';
import HttpError from '../utils/HttpError.js';

export async function registerUser(body) {
  const { first_name, last_name, email, password } = body ?? {};
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
}


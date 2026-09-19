import * as authRepository from '../repositories/auth.repository.js';
import { comparePassword } from '../utils/hash.js';
import { signToken } from '../utils/token.js';
import HttpError from '../utils/HttpError.js';

export async function login(body) {
  const { email, password } = body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email y contraseña son obligatorios');
  }
  const user = await authRepository.findCredentials(email.trim().toLowerCase());
  if (!user || !(await comparePassword(password, user.password))) {
    throw new HttpError(401, 'Credenciales inválidas');
  }
  return { token: signToken(user._id), user: {
    id: user._id.toString(), first_name: user.first_name, last_name: user.last_name,
    email: user.email, role: user.role,
  } };
}

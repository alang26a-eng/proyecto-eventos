import jwt from 'jsonwebtoken';
import { config } from '../config/env.config.js';
import HttpError from './HttpError.js';

function secret() {
  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret.startsWith('reemplazar')) {
    throw new HttpError(503, 'Falta configurar un JWT_SECRET seguro de al menos 32 caracteres');
  }
  return config.jwtSecret;
}
export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, secret(), {
    algorithm: 'HS256', subject: user._id.toString(), expiresIn: config.jwtExpiresIn,
    issuer: 'eventhub', audience: 'eventhub-api',
  });
}
export function verifyToken(token) {
  return jwt.verify(token, secret(), {
    algorithms: ['HS256'], issuer: 'eventhub', audience: 'eventhub-api',
  });
}

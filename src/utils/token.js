import jwt from 'jsonwebtoken';
import { config } from '../config/env.config.js';
import HttpError from './HttpError.js';

function secret() {
  if (!config.jwtSecret || config.jwtSecret.length < 32 || config.jwtSecret.startsWith('reemplazar')) {
    throw new HttpError(503, 'Falta configurar un JWT_SECRET seguro de al menos 32 caracteres');
  }
  return config.jwtSecret;
}
export function signToken(userId) {
  return jwt.sign({}, secret(), {
    algorithm: 'HS256', subject: userId.toString(), expiresIn: '1h',
    issuer: 'eventhub', audience: 'eventhub-api',
  });
}
export function verifyToken(token) {
  return jwt.verify(token, secret(), {
    algorithms: ['HS256'], issuer: 'eventhub', audience: 'eventhub-api',
  });
}

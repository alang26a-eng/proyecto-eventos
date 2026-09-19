import HttpError from '../utils/HttpError.js';

export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) throw new HttpError(401, 'No autenticado');
  if (!allowedRoles.includes(req.user.role)) throw new HttpError(403, 'No tenés permisos para realizar esta acción');
  next();
};

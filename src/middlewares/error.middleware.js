import HttpError from '../utils/HttpError.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) {
    return res.status(error.status).json({ status: 'error', message: error.message });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'El cuerpo debe ser un JSON válido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'El cuerpo de la solicitud es demasiado grande' });
  }
  // No exponer errores que puedan contener datos o credenciales.
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
}


import { userDTO } from '../dto/user.dto.js';
export function register(req, res) {
  res.status(201).json({ status: 'success', payload: userDTO(req.user) });
}
export function getSessionsStatus(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Registro disponible en POST /api/sessions/register. Login disponible en POST /api/sessions/login.',
  });
}

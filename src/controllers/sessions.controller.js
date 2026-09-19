import { registerUser } from '../services/sessions.service.js';

export async function register(req, res) {
  const user = await registerUser(req.body);
  res.status(201).json({ status: 'success', payload: user });
}
export function getSessionsStatus(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Registro disponible en POST /api/sessions/register. Login disponible en POST /api/sessions/login.',
  });
}

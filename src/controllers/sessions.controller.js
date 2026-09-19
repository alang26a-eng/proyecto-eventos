export function register(req, res) {
  res.status(201).json({ status: 'success', payload: req.user });
}
export function getSessionsStatus(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'Registro disponible en POST /api/sessions/register. Login disponible en POST /api/sessions/login.',
  });
}

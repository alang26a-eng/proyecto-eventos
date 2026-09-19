export function getSessionsStatus(req, res) {
  res.status(200).json({
    status: 'pending',
    message: 'Estructura de sesiones preparada. Autenticación pendiente.',
  });
}

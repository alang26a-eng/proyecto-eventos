import { signToken } from '../utils/jwt.js';
import { config } from '../config/env.config.js';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: config.nodeEnv === 'production', path: '/' });
export function loginUser(req, res) {
  const payload = { token: signToken({ ...req.user, _id: req.user.id }), user: req.user };
  res.cookie('currentUser', payload.token, { ...cookieOptions(), maxAge: 3600000 });
  res.json({ status: 'success', message: 'Login correcto', payload });
}
export function currentUser(req, res) {
  const { id, email, role } = req.user;
  res.json({ status: 'success', payload: { id, email, role } });
}
export function logoutUser(req, res) {
  res.clearCookie('currentUser', cookieOptions());
  res.json({ status: 'success', message: 'Sesión cerrada' });
}

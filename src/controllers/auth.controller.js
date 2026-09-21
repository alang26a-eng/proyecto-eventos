import { createSession, describeCurrentUser } from '../services/auth.service.js';
import { config } from '../config/env.config.js';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: config.nodeEnv === 'production', path: '/' });
export function loginUser(req, res) {
  const payload = createSession(req.user);
  res.cookie('currentUser', payload.token, { ...cookieOptions(), maxAge: 3600000 });
  res.json({ status: 'success', message: 'Login correcto', payload });
}
export function currentUser(req, res) {

  res.json({ status: 'success', payload: describeCurrentUser(req.user) });
}
export function logoutUser(req, res) {
  res.clearCookie('currentUser', cookieOptions());
  res.json({ status: 'success', message: 'Sesión cerrada' });
}

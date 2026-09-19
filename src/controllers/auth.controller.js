import { login } from '../services/auth.service.js';
export async function loginUser(req, res) {
  res.json({ status: 'success', payload: await login(req.body) });
}

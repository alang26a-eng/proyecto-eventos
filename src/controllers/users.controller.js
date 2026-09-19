import * as service from '../services/users.service.js';
export async function listUsers(req, res) {
  res.json({ status: 'success', ...await service.listUsers(req.query) });
}

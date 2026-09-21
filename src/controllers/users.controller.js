import { adminUserDTO } from '../dto/user.dto.js';
import * as service from '../services/users.service.js';
export async function listUsers(req, res) {
  const result = await service.listUsers(req.query);
  res.json({ status: 'success', ...result, payload: result.payload.map(adminUserDTO) });
}

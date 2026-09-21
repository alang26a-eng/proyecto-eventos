import * as usersDao from '../dao/users.dao.js';
export const findCredentials = email => usersDao.findCredentials(email);
export const findIdentity = id => usersDao.findIdentity(id);
export const setRole = (email, role) => usersDao.setRole(email, role);

export function findByEmail(email) {
  return usersDao.findByEmail(email);
}
export function createUser(data) {
  return usersDao.createUser(data);
}

export { listPublic, countUsers } from '../dao/users.dao.js';

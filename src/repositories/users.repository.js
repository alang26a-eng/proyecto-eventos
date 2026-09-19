import * as usersDao from '../dao/users.dao.js';

export function findByEmail(email) {
  return usersDao.findByEmail(email);
}
export function createUser(data) {
  return usersDao.createUser(data);
}


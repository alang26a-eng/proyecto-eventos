import * as authDao from '../dao/auth.dao.js';
export const findCredentials = email => authDao.findCredentials(email);
export const findIdentity = id => authDao.findIdentity(id);

import User from '../models/User.js';

export function findByEmail(email) {
  return User.findOne({ email }).exec();
}
export function createUser(data) {
  return User.create(data);
}


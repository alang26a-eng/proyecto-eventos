import User from '../models/User.js';
export function findCredentials(email) {
  return User.findOne({ email }).select('+password').exec();
}
export function findIdentity(id) {
  return User.findById(id).select('_id email first_name last_name role').exec();
}

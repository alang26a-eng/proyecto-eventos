import User from '../models/User.js';
export const listPublic = (skip, limit) => User.find().select('_id first_name last_name email role').sort({ _id: 1 }).skip(skip).limit(limit).lean();
export const countUsers = () => User.countDocuments();

export function findByEmail(email) {
  return User.findOne({ email }).exec();
}
export function createUser(data) {
  return User.create(data);
}


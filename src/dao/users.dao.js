import User from '../models/User.js';
export const initialize = () => User.init();
export const findCredentials = email => User.findOne({ email }).select('+password').exec();
export const findIdentity = id => User.findById(id).select('_id email first_name last_name role').exec();
export const setRole = (email, role) => User.findOneAndUpdate({ email }, { $set: { role } }, { returnDocument: 'after', runValidators: true });
export const listPublic = (skip, limit) => User.find().select('_id first_name last_name email role').sort({ _id: 1 }).skip(skip).limit(limit).lean();
export const countUsers = () => User.countDocuments();

export function findByEmail(email) {
  return User.findOne({ email }).exec();
}
export function createUser(data) {
  return User.create(data);
}


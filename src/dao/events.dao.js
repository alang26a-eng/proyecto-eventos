import Event from '../models/Event.js';
export const initialize = () => Event.init();
import mongoose from 'mongoose';

export const list = (filter, sort, skip, limit) => Event.find(filter)
  .select('title description category date endDate location capacity price organizer status').sort(sort).skip(skip).limit(limit).lean();
export const count = filter => Event.countDocuments(filter);
export const findById = id => Event.findById(id).exec();
export const create = data => Event.create(data);
export const transaction = operation => mongoose.connection.transaction(operation);
export const update = (id, changes, session) => Event.findByIdAndUpdate(id, { $set: changes },
  { returnDocument: 'after', runValidators: true, session }).exec();
export function lockForBooking(id, session) {
  return Event.findOneAndUpdate({ _id: id }, { $inc: { bookingVersion: 1 } },
    { returnDocument: 'after', session }).exec();
}

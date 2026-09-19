import Event from '../models/Event.js';

export const listPublished = () => Event.find({ status: 'published' })
  .select('title description date endDate location capacity organizer status').sort({ date: 1 }).lean();
export const findById = id => Event.findById(id).exec();
export const create = data => Event.create(data);
export function lockForBooking(id, session) {
  return Event.findOneAndUpdate({ _id: id }, { $inc: { bookingVersion: 1 } },
    { returnDocument: 'after', session }).exec();
}

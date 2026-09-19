import mongoose from 'mongoose';
import Ticket, { ACTIVE_STATUSES } from '../models/Ticket.js';

export const transaction = operation => mongoose.connection.transaction(operation);
export const findById = (id, session = null) => Ticket.findById(id).session(session).exec();
export const findActive = (user, event, session) =>
  Ticket.findOne({ user, event, status: { $in: ACTIVE_STATUSES } }).session(session).exec();
export async function occupied(event, session) {
  const result = await Ticket.aggregate([
    { $match: { event, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: null, quantity: { $sum: '$quantity' } } },
  ]).session(session);
  return result[0]?.quantity ?? 0;
}
export async function create(data, session) {
  const [ticket] = await Ticket.create([data], { session });
  return ticket;
}
export const cancel = (id, session) => Ticket.findByIdAndUpdate(id,
  { $set: { status: 'cancelled', cancelledAt: new Date() } }, { returnDocument: 'after', session }).exec();
export const listOwn = user => Ticket.find({ user })
  .populate('event', 'title date location').sort({ createdAt: -1 }).lean();
export const listForEvent = event => Ticket.find({ event }).sort({ createdAt: -1 }).lean();
export const setEmailStatus = (id, emailStatus) =>
  Ticket.updateOne({ _id: id }, { $set: { emailStatus } }).exec();

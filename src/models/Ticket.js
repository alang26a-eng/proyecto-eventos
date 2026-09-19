import mongoose from 'mongoose';

export const ACTIVE_STATUSES = ['confirmed', 'pending'];
const ticketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'confirmed', required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  reservationCode: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  cancelledAt: { type: Date, default: null },
  emailStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
});
// Una inscripción activa por usuario/evento; permite reinscribir después de cancelar.
ticketSchema.index({ user: 1, event: 1 }, {
  unique: true, partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
});
ticketSchema.index({ event: 1, status: 1 });
export default mongoose.model('Ticket', ticketSchema);

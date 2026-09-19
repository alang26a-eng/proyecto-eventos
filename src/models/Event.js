import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  date: { type: Date, required: true },
  endDate: { type: Date, default: null },
  location: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['draft', 'published', 'cancelled', 'finished'], default: 'draft' },
  // Escritura común para serializar inscripciones/cancelaciones dentro de una transacción.
  bookingVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });
export default mongoose.model('Event', eventSchema);

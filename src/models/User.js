import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'organizer', 'admin'], default: 'user' },
}, {
  timestamps: true,
  toJSON: { transform: (_doc, result) => { delete result.password; return result; } },
});
export default mongoose.model('User', userSchema);


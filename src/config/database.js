import mongoose from 'mongoose';
import User from '../models/User.js';

export async function connectDatabase(uri) {
  if (!uri) throw new Error('Falta configurar MONGO_URL');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await User.init();
}


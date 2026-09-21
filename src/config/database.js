import mongoose from 'mongoose';
import { initialize as initializeUsers } from '../dao/users.dao.js';
import { initialize as initializeEvents } from '../dao/events.dao.js';
import { initialize as initializeTickets } from '../dao/tickets.dao.js';
export async function connectDatabase(uri) {
  if (!uri) throw new Error('Falta configurar MONGO_URL');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await initializeUsers();
  await initializeEvents();
  await initializeTickets();
}

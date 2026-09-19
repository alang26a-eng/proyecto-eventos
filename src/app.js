import express from 'express';
import usersRouter from './routes/users.router.js';
import passport from './config/passport.config.js';
import eventsRouter from './routes/events.router.js';
import sessionsRouter from './routes/sessions.router.js';
import ticketsRouter from './routes/tickets.router.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();
app.use(express.json());
app.use(passport.initialize());
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Servidor activo' });
});
app.use('/api/events', eventsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/tickets', ticketsRouter);
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});
app.use(errorHandler);
export default app;

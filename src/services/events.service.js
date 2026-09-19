import * as events from '../repositories/events.repository.js';
import HttpError from '../utils/HttpError.js';

export const listEvents = () => events.listPublished();
export async function createEvent(body, actor) {
  if (!['organizer', 'admin'].includes(actor.role)) throw new HttpError(403, 'Solo organizadores o administradores pueden crear eventos');
  const { title, description = '', date, endDate = null, location, capacity, status = 'draft' } = body ?? {};
  if (typeof title !== 'string' || !title.trim() || typeof location !== 'string' || !location.trim()) {
    throw new HttpError(400, 'Título y ubicación son obligatorios');
  }
  if (typeof description !== 'string') throw new HttpError(400, 'Descripción inválida');
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) throw new HttpError(400, 'Fecha inválida');
  const start = new Date(date);
  if (start <= new Date()) throw new HttpError(400, 'La fecha debe ser futura');
  let end = null;
  if (endDate !== null) {
    if (typeof endDate !== 'string' || !Number.isFinite(Date.parse(endDate))) throw new HttpError(400, 'Fecha de finalización inválida');
    end = new Date(endDate);
    if (end < start) throw new HttpError(400, 'La finalización no puede ser anterior al inicio');
  }
  if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new HttpError(400, 'La capacidad debe ser un entero positivo');
  if (!['draft', 'published'].includes(status)) throw new HttpError(400, 'Estado inicial inválido');
  return events.create({ title: title.trim(), description, date: start, endDate: end,
    location: location.trim(), capacity, status, organizer: actor._id });
}

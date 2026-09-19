import * as events from '../repositories/events.repository.js';
import HttpError from '../utils/HttpError.js';
import { requireObjectId } from '../utils/objectId.js';

export const listEvents = () => events.listPublished();
async function changeOwnedEvent(eventId, actor, buildChanges) {
  if (!['organizer', 'admin'].includes(actor.role)) throw new HttpError(403, 'No tenés permisos para realizar esta acción');
  const id = requireObjectId(eventId, 'Evento');
  return events.transaction(async session => {
    // Comparte la escritura con reservas: cancelar y reservar no pueden intercalarse.
    const event = await events.lockForBooking(id, session);
    if (!event) throw new HttpError(404, 'El evento no existe');
    if (actor.role !== 'admin' && !event.organizer.equals(actor._id)) throw new HttpError(403, 'El evento pertenece a otro organizador');
    return events.update(id, buildChanges(event), session);
  });
}
export function updateEvent(eventId, body, actor) {
  return changeOwnedEvent(eventId, actor, () => {
    const allowed = ['title', 'description', 'location'];
    if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some(key => !allowed.includes(key))) {
      throw new HttpError(400, 'Solo se pueden modificar title, description y location');
    }
    const changes = {};
    for (const key of Object.keys(body)) {
      if (typeof body[key] !== 'string' || (key !== 'description' && !body[key].trim())) throw new HttpError(400, 'Datos del evento inválidos');
      changes[key] = body[key].trim();
    }
    return changes;
  });
}
export function cancelEvent(eventId, actor) {
  return changeOwnedEvent(eventId, actor, event => {
    if (['cancelled', 'finished'].includes(event.status) || (event.endDate ?? event.date) <= new Date()) throw new HttpError(409, 'El evento ya está cancelado o finalizado');
    return { status: 'cancelled' };
  });
}
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

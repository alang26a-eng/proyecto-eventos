import { randomUUID } from 'node:crypto';
import * as tickets from '../repositories/tickets.repository.js';
import * as events from '../repositories/events.repository.js';
import { sendConfirmation } from './mail.service.js';
import { requireObjectId } from '../utils/objectId.js';
import HttpError from '../utils/HttpError.js';

export async function registerTicket(eventId, body, actor) {
  const id = requireObjectId(eventId, 'Evento');
  const quantity = body?.quantity;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new HttpError(400, 'quantity debe ser un entero positivo');
  let result;
  try {
    result = await tickets.transaction(async session => {
      // Escribir primero el mismo evento fuerza conflicto/reintento entre reservas concurrentes.
      const event = await events.lockForBooking(id, session);
      if (!event) throw new HttpError(404, 'El evento no existe');
      if (event.status !== 'published') throw new HttpError(409, 'El evento no está publicado o está cancelado/finalizado');
      if ((event.endDate ?? event.date) <= new Date()) throw new HttpError(409, 'El evento ya finalizó');
      if (await tickets.findActive(actor._id, id, session)) throw new HttpError(409, 'Ya tenés una inscripción activa para este evento');
      const used = await tickets.occupied(id, session);
      if (event.capacity - used < quantity) throw new HttpError(409, 'No hay cupos suficientes para la cantidad solicitada');
      const ticket = await tickets.create({
        user: actor._id, event: id, quantity, status: 'confirmed', reservationCode: randomUUID(),
      }, session);
      return { ticket, event };
    });
  } catch (error) {
    if (error.code === 11000) throw new HttpError(409, 'Ya existe una inscripción activa o un código de reserva duplicado');
    throw error;
  }
  // Efecto externo SOLO después del commit; nunca dentro del callback que MongoDB puede reintentar.
  let emailStatus = 'sent';
  try {
    await sendConfirmation(actor, result.event, result.ticket);
  } catch {
    emailStatus = 'failed';
  }
  // Una falla de correo no deshace una reserva confirmada ni induce a crear otra.
  try {
    await tickets.setEmailStatus(result.ticket._id, emailStatus);
  } catch {
    emailStatus = 'pending';
  }
  result.ticket.emailStatus = emailStatus;
  return { ticket: result.ticket, notification: emailStatus === 'sent'
    ? 'Confirmación aceptada por el servidor de correo'
    : 'Inscripción confirmada; el correo no pudo verificarse. Conservá tu código de reserva' };
}
export const listMyTickets = actor => tickets.listOwn(actor._id);
export async function listEventTickets(eventId, actor) {
  if (!['organizer', 'admin'].includes(actor.role)) throw new HttpError(403, 'No tenés permiso para consultar inscripciones del evento');
  const id = requireObjectId(eventId, 'Evento');
  const event = await events.findById(id);
  if (!event) throw new HttpError(404, 'El evento no existe');
  if (actor.role !== 'admin' && !event.organizer.equals(actor._id)) throw new HttpError(403, 'El evento pertenece a otro organizador');
  return tickets.listForEvent(id);
}
export async function cancelTicket(ticketId, actor) {
  const id = requireObjectId(ticketId, 'Ticket');
  const initial = await tickets.findById(id);
  if (!initial) throw new HttpError(404, 'El ticket no existe');
  if (actor.role !== 'admin' && !initial.user.equals(actor._id)) throw new HttpError(403, 'El ticket pertenece a otro usuario');
  return tickets.transaction(async session => {
    await events.lockForBooking(initial.event, session);
    const ticket = await tickets.findById(id, session);
    if (!ticket) throw new HttpError(404, 'El ticket no existe');
    if (actor.role !== 'admin' && !ticket.user.equals(actor._id)) throw new HttpError(403, 'El ticket pertenece a otro usuario');
    if (ticket.status === 'cancelled') throw new HttpError(409, 'El ticket ya está cancelado');
    return tickets.cancel(id, session);
  });
}

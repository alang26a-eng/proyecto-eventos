import * as events from '../repositories/events.repository.js';
import { occupied } from '../repositories/tickets.repository.js';
import HttpError from '../utils/HttpError.js';
import { requireObjectId } from '../utils/objectId.js';

const statuses = ['draft', 'published', 'cancelled', 'finished'];
const fields = ['title', 'description', 'category', 'date', 'endDate', 'location', 'capacity', 'price'];
const invalid = message => new HttpError(400, message);
function dateValue(value, name) {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) throw invalid(name + ' inválida');
  return new Date(value);
}
function record(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('Datos del evento inválidos');
}
function validateFields(body) {
  record(body);
  const result = {};
  for (const key of ['title', 'description', 'category', 'location']) {
    if (typeof body[key] !== 'string' || !body[key].trim()) throw invalid(key + ' es obligatorio');
    result[key] = body[key].trim();
  }
  result.date = dateValue(body.date, 'Fecha');
  if (result.date <= new Date()) throw invalid('La fecha debe ser futura');
  result.endDate = body.endDate == null ? null : dateValue(body.endDate, 'Fecha de finalización');
  if (result.endDate && result.endDate < result.date) throw invalid('La finalización no puede ser anterior al inicio');
  if (!Number.isSafeInteger(body.capacity) || body.capacity <= 0) throw invalid('La capacidad debe ser un entero positivo');
  result.capacity = body.capacity;
  const price = body.price === undefined ? 0 : body.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) throw invalid('El precio debe ser un número mayor o igual a cero');
  result.price = price;
  return result;
}
export async function createEvent(body, actor) {
  if (!['organizer', 'admin'].includes(actor.role)) throw new HttpError(403, 'No tenés permisos para realizar esta acción');
  const data = validateFields(body);
  const status = body.status ?? 'draft';
  if (!['draft', 'published'].includes(status)) throw invalid('Estado inicial inválido');
  return events.create({ ...data, status, organizer: actor._id });
}
export async function getEvent(eventId) {
  const event = await events.findById(requireObjectId(eventId, 'Evento'));
  if (!event) throw new HttpError(404, 'El evento no existe');
  return event;
}
export async function listEvents(query = {}) {
  const allowed = ['status','category','location','dateFrom','dateTo','page','limit','sort'];
  if (Object.keys(query).some(key => !allowed.includes(key) || typeof query[key] !== 'string')) throw invalid('Filtros inválidos');
  const pageText = query.page ?? '1', limitText = query.limit ?? '20';
  if (!/^[1-9]\d*$/.test(pageText) || !/^[1-9]\d*$/.test(limitText)) throw invalid('Paginación inválida');
  const page = Number(pageText), limit = Number(limitText);
  if (!Number.isSafeInteger(page) || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) throw invalid('Paginación inválida');
  const status = query.status ?? 'published';
  if (!statuses.includes(status)) throw invalid('Estado inválido');
  const filter = { status };
  for (const key of ['category', 'location']) {
    if (query[key] !== undefined) {
      if (!query[key].trim()) throw invalid('Filtro vacío');
      filter[key] = query[key].trim();
    }
  }
  if (query.dateFrom !== undefined || query.dateTo !== undefined) {
    filter.date = {};
    if (query.dateFrom !== undefined) filter.date.$gte = dateValue(query.dateFrom, 'dateFrom');
    if (query.dateTo !== undefined) filter.date.$lte = dateValue(query.dateTo, 'dateTo');
    if (filter.date.$gte && filter.date.$lte && filter.date.$gte > filter.date.$lte) throw invalid('Rango de fechas inválido');
  }
  const sortText = query.sort ?? 'date';
  const sortField = sortText.replace(/^-/, '');
  if (!['date','price','title','capacity'].includes(sortField)) throw invalid('Ordenamiento inválido');
  const sort = { [sortField]: sortText.startsWith('-') ? -1 : 1, _id: 1 };
  const [data, total] = await Promise.all([events.list(filter, sort, (page - 1) * limit, limit), events.count(filter)]);
  return { data, page, limit, total, totalPages: Math.ceil(total / limit) };
}
async function changeOwnedEvent(eventId, actor, buildChanges) {
  if (!['organizer', 'admin'].includes(actor.role)) throw new HttpError(403, 'No tenés permisos para realizar esta acción');
  const id = requireObjectId(eventId, 'Evento');
  return events.transaction(async session => {
    const event = await events.lockForBooking(id, session);
    if (!event) throw new HttpError(404, 'El evento no existe');
    if (actor.role !== 'admin' && !event.organizer.equals(actor._id)) throw new HttpError(403, 'El evento pertenece a otro organizador');
    if (['cancelled', 'finished'].includes(event.status)) throw new HttpError(409, 'El evento cancelado o finalizado no puede modificarse');
    return events.update(id, await buildChanges(event, session), session);
  });
}
export function replaceEvent(eventId, body, actor) {
  return changeOwnedEvent(eventId, actor, async (event, session) => {
    record(body);
    if (Object.keys(body).some(key => !fields.includes(key))) throw invalid('Campos no permitidos; el estado se cambia mediante /status');
    if ((event.endDate ?? event.date) <= new Date()) throw new HttpError(409, 'El evento ya finalizó');
    const changes = validateFields(body);
    if (changes.capacity < await occupied(event._id, session)) throw new HttpError(409, 'La capacidad no puede ser menor que los cupos ocupados');
    return changes;
  });
}
export function updateEvent(eventId, body, actor) {
  return changeOwnedEvent(eventId, actor, event => {
    record(body);
    const keys = Object.keys(body);
    if (!keys.length || keys.some(key => !['title','description','location'].includes(key))) throw invalid('Solo se pueden modificar title, description y location');
    if ((event.endDate ?? event.date) <= new Date()) throw new HttpError(409, 'El evento ya finalizó');
    const changes = {};
    for (const key of keys) {
      if (typeof body[key] !== 'string' || !body[key].trim()) throw invalid('Datos del evento inválidos');
      changes[key] = body[key].trim();
    }
    return changes;
  });
}
export function changeStatus(eventId, body, actor) {
  return changeOwnedEvent(eventId, actor, event => {
    record(body);
    if (Object.keys(body).length !== 1 || !statuses.includes(body.status)) throw invalid('Enviar solamente un status válido');
    const ended = (event.endDate ?? event.date) <= new Date();
    if (body.status === 'published') {
      if (ended) throw new HttpError(409, 'No se puede publicar un evento finalizado');
      // Los eventos heredados deben completar sus campos antes de publicarse.
      if (!event.description?.trim() || !event.category?.trim()) throw invalid('Completá description y category antes de publicar');
    }
    if (body.status === 'finished' && !ended) throw new HttpError(409, 'El evento todavía no finalizó');
    if (ended && body.status !== 'finished') throw new HttpError(409, 'El evento ya finalizó');
    return { status: body.status };
  });
}
export const cancelEvent = (eventId, actor) => changeStatus(eventId, { status: 'cancelled' }, actor);

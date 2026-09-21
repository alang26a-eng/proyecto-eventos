import { pick, referenceId } from './fields.js';
export function eventDTO(event) {
  if (event == null) return event;
  const result = { _id: referenceId(event), ...pick(event, ['title','description','category','date','endDate','location','capacity','price','status','createdAt','updatedAt','__v','bookingVersion']) };
  if (event.organizer !== undefined) result.organizer = referenceId(event.organizer);
  return result;
}
export function ticketEventDTO(event) {
  if (event == null) return event;
  if (typeof event === 'string' || typeof event.toHexString === 'function') return referenceId(event);
  return { _id: referenceId(event), ...pick(event, ['title', 'date', 'location']) };
}

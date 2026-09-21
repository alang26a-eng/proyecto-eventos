import { pick, referenceId } from './fields.js';
import { ticketEventDTO } from './event.dto.js';
export function ticketDTO(ticket) {
  return { _id: referenceId(ticket), user: referenceId(ticket.user), event: ticketEventDTO(ticket.event),
    ...pick(ticket, ['status','quantity','reservationCode','createdAt','cancelledAt','emailStatus','__v']) };
}

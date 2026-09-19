import * as service from '../services/tickets.service.js';
export async function create(req, res) {
  const result = await service.registerTicket(req.params.eid, req.body, req.user);
  res.status(201).json({ status: 'success', payload: result.ticket, notification: result.notification });
}
export async function listMine(req, res) {
  res.json({ status: 'success', payload: await service.listMyTickets(req.user) });
}
export async function listForEvent(req, res) {
  res.json({ status: 'success', payload: await service.listEventTickets(req.params.eid, req.user) });
}
export async function cancel(req, res) {
  res.json({ status: 'success', payload: await service.cancelTicket(req.params.tid, req.user) });
}

import * as service from '../services/events.service.js';
export async function getEvents(req, res) {
  res.json(await service.listEvents());
}
export async function createEvent(req, res) {
  res.status(201).json({ status: 'success', payload: await service.createEvent(req.body, req.user) });
}
export async function updateEvent(req, res) {
  res.json({ status: 'success', payload: await service.updateEvent(req.params.eid, req.body, req.user) });
}
export async function cancelEvent(req, res) {
  res.json({ status: 'success', payload: await service.cancelEvent(req.params.eid, req.user) });
}

import * as service from '../services/events.service.js';
export async function getEvents(req, res) {
  res.json(await service.listEvents());
}
export async function createEvent(req, res) {
  res.status(201).json({ status: 'success', payload: await service.createEvent(req.body, req.user) });
}

import { eventDTO } from '../dto/event.dto.js';
import * as service from '../services/events.service.js';
export async function getEvents(req, res) {
  const result = await service.listEvents(req.query);
  res.json({ ...result, data: result.data.map(eventDTO) });
}
export async function getEvent(req, res) {
  res.json({ status: 'success', payload: eventDTO(await service.getEvent(req.params.eid)) });
}
export async function replaceEvent(req, res) {
  res.json({ status: 'success', payload: eventDTO(await service.replaceEvent(req.params.eid, req.body, req.user)) });
}
export async function changeStatus(req, res) {
  res.json({ status: 'success', payload: eventDTO(await service.changeStatus(req.params.eid, req.body, req.user)) });
}
export async function createEvent(req, res) {
  res.status(201).json({ status: 'success', payload: eventDTO(await service.createEvent(req.body, req.user)) });
}
export async function updateEvent(req, res) {
  res.json({ status: 'success', payload: eventDTO(await service.updateEvent(req.params.eid, req.body, req.user)) });
}
export async function cancelEvent(req, res) {
  res.json({ status: 'success', payload: eventDTO(await service.cancelEvent(req.params.eid, req.user)) });
}

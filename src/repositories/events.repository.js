import * as dao from '../dao/events.dao.js';
export const listPublished = () => dao.listPublished();
export const findById = id => dao.findById(id);
export const create = data => dao.create(data);
export const transaction = operation => dao.transaction(operation);
export const update = (id, changes, session) => dao.update(id, changes, session);
export const lockForBooking = (id, session) => dao.lockForBooking(id, session);

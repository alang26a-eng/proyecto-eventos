import * as dao from '../dao/events.dao.js';
export const list = (filter, sort, skip, limit) => dao.list(filter, sort, skip, limit);
export const count = filter => dao.count(filter);
export const findById = id => dao.findById(id);
export const create = data => dao.create(data);
export const transaction = operation => dao.transaction(operation);
export const update = (id, changes, session) => dao.update(id, changes, session);
export const lockForBooking = (id, session) => dao.lockForBooking(id, session);

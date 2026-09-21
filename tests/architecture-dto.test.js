import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { currentUserDTO, userDTO } from '../src/dto/user.dto.js';
import { eventDTO } from '../src/dto/event.dto.js';
import { ticketDTO } from '../src/dto/ticket.dto.js';
import { errorHandler } from '../src/middlewares/error.middleware.js';
import HttpError from '../src/utils/HttpError.js';

test('M8: DTO de usuario y current excluyen password, hash y campos internos', () => {
  const source = { _id: 'user-id', first_name: 'Ana', last_name: 'Test', email: 'ana@example.test', role: 'user', password: 'hash-secreto', resetToken: 'token-secreto' };
  assert.deepEqual(currentUserDTO(source), { id: 'user-id', email: source.email, role: 'user' });
  assert.deepEqual(Object.keys(userDTO(source)).sort(), ['id','first_name','last_name','email','role'].sort());
});

test('M8: DTO filtra relaciones pobladas aunque traigan password y secretos', () => {
  const user = { _id: 'user-id', email: 'privado@example.test', password: 'hash-secreto' };
  const event = { _id: 'event-id', title: 'Taller', date: '2030-01-01', location: 'Sala', organizer: user, password: 'secreto', bookingVersion: 10 };
  const eventResult = eventDTO(event);
  assert.equal(eventResult.organizer, 'user-id');
  assert.equal(eventResult.bookingVersion, 10); // Conserva metadatos ya presentes en respuestas anteriores.
  assert.equal(eventResult.password, undefined);
  const result = ticketDTO({ _id: 'ticket-id', user, event, status: 'confirmed', quantity: 1, reservationCode: 'abc', password: 'secreto' });
  assert.equal(result.user, 'user-id');
  assert.deepEqual(result.event, { _id: 'event-id', title: 'Taller', date: '2030-01-01', location: 'Sala' });
  assert.equal(JSON.stringify(result).includes('secreto'), false);
  assert.equal(JSON.stringify(result).includes('privado'), false);
  assert.equal(ticketDTO({ _id: 't', user: null, event: null }).event, null);
});

test('M8: modelos solo desde DAO; services y controllers no acceden a persistencia', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  async function scan(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      const relative = directory + '/' + entry.name;
      if (entry.isDirectory()) { await scan(relative); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const source = await readFile(path.join(root, relative), 'utf8');
      if (/from\s+['"][^'"]*\/models\//.test(source)) assert.ok(relative.startsWith('src/dao/'), relative);
      if (/^src\/(services|controllers)\//.test(relative)) assert.equal(/from\s+['"](?:mongoose|[^'"]*\/(?:dao|models)\/)/.test(source), false, relative);
    }
  }
  await scan('src');
  await scan('scripts');
});

test('M8: middleware conserva códigos de negocio y oculta el error interno', () => {
  for (const status of [400, 401, 403, 404, 409, 500]) {
    let response;
    const res = { headersSent: false, status(code) { this.code = code; return this; }, json(body) { response = { status: this.code, body }; } };
    const error = status === 500 ? new Error('password=secreto-interno') : new HttpError(status, 'Error de negocio');
    errorHandler(error, {}, res, () => assert.fail('No debe continuar'));
    assert.equal(response.status, status);
    assert.equal(JSON.stringify(response).includes('secreto-interno'), false);
  }
});

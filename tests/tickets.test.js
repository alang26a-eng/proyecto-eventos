import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SMTPServer } from 'smtp-server';
import Event from '../src/models/Event.js';
import User from '../src/models/User.js';
import Ticket from '../src/models/Ticket.js';
import { hashPassword } from '../src/utils/hash.js';
import { connectDatabase } from '../src/config/database.js';

let db, http, smtp, base;
let rejectMail = false;
const messages = [];
const users = {};
const tokens = {};
const secret = randomBytes(48).toString('hex');
before(async () => {
  smtp = new SMTPServer({
    authOptional: true, disabledCommands: ['AUTH', 'STARTTLS'],
    onData(stream, session, callback) {
      let raw = '';
      stream.on('data', chunk => { raw += chunk.toString(); });
      stream.on('end', () => {
        if (rejectMail) return callback(new Error('Rechazo SMTP de prueba'));
        messages.push({ raw, recipients: session.envelope.rcptTo.map(item => item.address) });
        callback(null, 'Mensaje recibido');
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', resolve);
  });
  process.env.JWT_SECRET = secret;
  process.env.MAIL_HOST = '127.0.0.1';
  process.env.MAIL_PORT = String(smtp.server.address().port);
  process.env.MAIL_FROM = 'EventHub <no-reply@example.test>';
  process.env.MAIL_USER = '';
  process.env.MAIL_PASS = '';
  const { default: app } = await import('../src/app.js');
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(db.getUri('eventhub_tickets_test'));
  http = app.listen(0, '127.0.0.1');
  await new Promise(resolve => http.once('listening', resolve));
  base = 'http://127.0.0.1:' + http.address().port;
  const password = await hashPassword('PruebaSegura123');
  for (const [key, role] of Object.entries({ ana: 'user', bob: 'user', organizer: 'organizer', other: 'organizer', admin: 'admin' })) {
    users[key] = await User.create({ first_name: key, last_name: 'Test', email: key + '@example.test', password, role });
    const response = await api('/api/sessions/login', 'POST', undefined, { email: key + '@example.test', password: 'PruebaSegura123' });
    assert.equal(response.status, 200);
    assert.equal(response.body.payload.user.password, undefined);
    tokens[key] = response.body.payload.token;
  }
});
after(async () => {
  if (http) await new Promise(resolve => http.close(resolve));
  await mongoose.disconnect();
  if (db) await db.stop();
  if (smtp) await new Promise(resolve => smtp.close(resolve));
});
async function api(path, method = 'GET', token, body) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
function event(overrides = {}) {
  return Event.create({
    title: 'Encuentro', description: 'Test', date: new Date(Date.now() + 86400000),
    location: 'Auditorio', capacity: 4, organizer: users.organizer._id, status: 'published',
    ...overrides,
  });
}
const enroll = (e, key = 'ana', quantity = 1, extras = {}) =>
  api('/api/events/' + e._id + '/tickets', 'POST', tokens[key], { quantity, ...extras });

test('Inscripción 201 persiste referencias, código único y confirmación SMTP real', async () => {
  const e = await event();
  const beforeMessages = messages.length;
  const result = await enroll(e, 'ana', 2, { user: users.bob._id, status: 'cancelled', reservationCode: 'inyectado' });
  assert.equal(result.status, 201);
  const ticket = result.body.payload;
  assert.equal(ticket.user, users.ana.id);
  assert.equal(ticket.event, e.id);
  assert.equal(ticket.quantity, 2);
  assert.equal(ticket.status, 'confirmed');
  assert.equal(ticket.emailStatus, 'sent');
  assert.equal(ticket.cancelledAt, null);
  assert.notEqual(ticket.reservationCode, 'inyectado');
  assert.ok(ticket.createdAt);
  const stored = await Ticket.findById(ticket._id);
  assert.ok(stored.user instanceof mongoose.Types.ObjectId);
  assert.ok(stored.event instanceof mongoose.Types.ObjectId);
  assert.equal(messages.length, beforeMessages + 1);
  assert.deepEqual(messages.at(-1).recipients, ['ana@example.test']);
  assert.ok(messages.at(-1).raw.includes(ticket.reservationCode));
});
test('Sin sesión, firma falsa y sesión vencida: 401', async () => {
  const e = await event();
  assert.equal((await api('/api/events/' + e.id + '/tickets', 'POST', undefined, { quantity: 1 })).status, 401);
  const options = { subject: users.ana.id, issuer: 'eventhub', audience: 'eventhub-api', algorithm: 'HS256' };
  const fake = jwt.sign({}, 'clave-falsa', options);
  const expired = jwt.sign({}, secret, { ...options, expiresIn: -1 });
  for (const token of [fake, expired, 'invalido']) {
    assert.equal((await api('/api/events/' + e.id + '/tickets', 'POST', token, { quantity: 1 })).status, 401);
  }
});
test('Evento inexistente 404 e identificador mal formado 400', async () => {
  for (const [id, status] of [[new mongoose.Types.ObjectId().toString(), 404], ['no-es-id', 400]]) {
    assert.equal((await api('/api/events/' + id + '/tickets', 'POST', tokens.ana, { quantity: 1 })).status, status);
  }
});
test('Eventos draft/cancelled/finished y fecha pasada: error de negocio', async () => {
  for (const status of ['draft', 'cancelled', 'finished']) {
    assert.equal((await enroll(await event({ status }))).status, 409);
  }
  assert.equal((await enroll(await event({ date: new Date(Date.now() - 10000) }))).status, 409);
  assert.equal((await enroll(await event({
    date: new Date(Date.now() - 20000), endDate: new Date(Date.now() - 10000),
  }))).status, 409);
});
test('quantity rechaza cero, negativos, decimales, strings y campos faltantes', async () => {
  const e = await event();
  for (const quantity of [0, -1, 1.5, '2', null, undefined, true, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await api('/api/events/' + e.id + '/tickets', 'POST', tokens.ana, { quantity })).status, 400);
  }
  assert.equal(await Ticket.countDocuments({ event: e._id }), 0);
});
test('Sin cupos suficientes y duplicado activo: 409 sin email adicional', async () => {
  const e = await event({ capacity: 2 });
  assert.equal((await enroll(e, 'ana', 2)).status, 201);
  const count = messages.length;
  const full = await enroll(e, 'bob');
  assert.equal(full.status, 409);
  assert.match(full.body.message, /cupos/);
  assert.equal((await enroll(e, 'ana')).status, 409);
  assert.equal(messages.length, count);
});
test('Cancelación propia conserva documento, libera cantidad y permite reinscripción', async () => {
  const e = await event({ capacity: 2 });
  const first = await enroll(e, 'ana', 2);
  const cancelled = await api('/api/tickets/' + first.body.payload._id + '/cancel', 'PATCH', tokens.ana);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.payload.status, 'cancelled');
  assert.ok(cancelled.body.payload.cancelledAt);
  const second = await enroll(e, 'ana', 2);
  assert.equal(second.status, 201);
  assert.notEqual(second.body.payload.reservationCode, first.body.payload.reservationCode);
  assert.equal(await Ticket.countDocuments({ event: e._id }), 2);
  assert.equal((await enroll(e, 'bob')).status, 409);
});
test('Cancelar ticket ajeno 403; admin puede; cancelar dos veces 409; inexistente 404', async () => {
  const e = await event();
  const result = await enroll(e);
  const path = '/api/tickets/' + result.body.payload._id + '/cancel';
  assert.equal((await api(path, 'PATCH', tokens.bob)).status, 403);
  assert.equal((await api(path, 'PATCH', tokens.admin)).status, 200);
  assert.equal((await api(path, 'PATCH', tokens.ana)).status, 409);
  assert.equal((await api('/api/tickets/' + new mongoose.Types.ObjectId() + '/cancel', 'PATCH', tokens.ana)).status, 404);
});
test('Listar inscripciones: user 403, organizador ajeno 403, propietario/admin 200', async () => {
  const e = await event();
  await enroll(e);
  const path = '/api/events/' + e.id + '/tickets';
  assert.equal((await api(path, 'GET', tokens.ana)).status, 403);
  assert.equal((await api(path, 'GET', tokens.other)).status, 403);
  for (const key of ['organizer', 'admin']) {
    const result = await api(path, 'GET', tokens[key]);
    assert.equal(result.status, 200);
    assert.equal(result.body.payload.length, 1);
    assert.equal(typeof result.body.payload[0].user, 'string');
    assert.equal(JSON.stringify(result.body).includes('password'), false);
  }
});
test('Mis tickets solo propios y populate limitado a título, fecha y ubicación', async () => {
  const e = await event();
  await enroll(e, 'bob');
  const result = await api('/api/tickets/my-tickets', 'GET', tokens.bob);
  assert.equal(result.status, 200);
  assert.ok(result.body.payload.length);
  for (const ticket of result.body.payload) {
    assert.equal(ticket.user, users.bob.id);
    assert.deepEqual(Object.keys(ticket.event).sort(), ['_id', 'title', 'date', 'location'].sort());
  }
  assert.equal(JSON.stringify(result.body).includes('password'), false);
});
test('Inscripciones simultáneas al último cupo: exactamente una confirmada', async () => {
  const e = await event({ capacity: 1 });
  const beforeCount = messages.length;
  const result = await Promise.all([enroll(e, 'ana'), enroll(e, 'bob')]);
  assert.deepEqual(result.map(r => r.status).sort(), [201, 409]);
  assert.equal(await Ticket.countDocuments({ event: e._id }), 1);
  assert.equal(messages.length, beforeCount + 1);
});
test('Dos solicitudes simultáneas del mismo usuario: un solo ticket activo', async () => {
  const e = await event();
  const result = await Promise.all([enroll(e), enroll(e)]);
  assert.deepEqual(result.map(r => r.status).sort(), [201, 409]);
  assert.equal(await Ticket.countDocuments({ event: e._id }), 1);
});
test('Pending ocupa cupo y bloquea duplicados; cancelar libera cupo', async () => {
  const e = await event({ capacity: 1 });
  const pending = await Ticket.create({ event: e._id, user: users.ana._id, status: 'pending', quantity: 1, reservationCode: 'pending-test' });
  assert.equal((await enroll(e, 'bob')).status, 409);
  assert.equal((await enroll(e, 'ana')).status, 409);
  await api('/api/tickets/' + pending.id + '/cancel', 'PATCH', tokens.ana);
  assert.equal((await enroll(e, 'bob')).status, 201);
});
test('Fallo SMTP no borra la inscripción y se informa sin datos internos', async () => {
  rejectMail = true;
  try {
    const e = await event();
    const result = await enroll(e);
    assert.equal(result.status, 201);
    assert.equal(result.body.payload.emailStatus, 'failed');
    assert.equal((await Ticket.findById(result.body.payload._id)).status, 'confirmed');
    assert.match(result.body.notification, /correo/);
    assert.equal(JSON.stringify(result.body).includes('Rechazo SMTP'), false);
    assert.equal((await enroll(e)).status, 409);
    assert.equal(await Ticket.countDocuments({ event: e._id }), 1);
  } finally { rejectMail = false; }
});

test('Todas las rutas de tickets requieren sesión', async () => {
  const e = await event();
  const result = await enroll(e);
  for (const [path, method] of [
    ['/api/tickets/my-tickets', 'GET'],
    ['/api/events/' + e.id + '/tickets', 'GET'],
    ['/api/tickets/' + result.body.payload._id + '/cancel', 'PATCH'],
  ]) {
    assert.equal((await api(path, method)).status, 401);
  }
});

test('El modelo rechaza estados fuera del enum y cantidades fraccionarias', async () => {
  const data = { user: users.ana._id, event: new mongoose.Types.ObjectId(), quantity: 1, reservationCode: 'schema-test' };
  await assert.rejects(new Ticket({ ...data, status: 'invalid' }).validate(), error => Boolean(error.errors.status));
  await assert.rejects(new Ticket({ ...data, quantity: 1.5 }).validate(), error => Boolean(error.errors.quantity));
});
test('Creación de evento: user 403, organizador publicado 201 con dueño autenticado', async () => {
  const data = { title: 'Nuevo', date: new Date(Date.now() + 86400000).toISOString(), location: 'Salón', capacity: 2, status: 'published', organizer: users.other.id };
  assert.equal((await api('/api/events', 'POST', tokens.ana, data)).status, 403);
  const result = await api('/api/events', 'POST', tokens.organizer, data);
  assert.equal(result.status, 201);
  assert.equal(result.body.payload.organizer, users.organizer.id);
});
test('Login incorrecto 401 y cambios de rol se aplican incluso con token anterior', async () => {
  assert.equal((await api('/api/sessions/login', 'POST', undefined, { email: users.ana.email, password: 'incorrecta' })).status, 401);
  const e = await event({ organizer: users.other._id });
  await User.updateOne({ _id: users.other._id }, { $set: { role: 'user' } });
  assert.equal((await api('/api/events/' + e.id + '/tickets', 'GET', tokens.other)).status, 403);
});

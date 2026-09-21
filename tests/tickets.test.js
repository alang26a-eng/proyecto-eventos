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
    title: 'Encuentro', description: 'Test', category: 'test', price: 0, date: new Date(Date.now() + 86400000),
    location: 'Auditorio', capacity: 4, organizer: users.organizer._id, status: 'published',
    ...overrides,
  });
}
const enroll = (e, key = 'ana', quantity = 1, extras = {}) =>
  api('/api/events/' + e._id + '/tickets', 'POST', tokens[key], { quantity, ...extras });

const eventBody = (changes = {}) => ({ title: 'Taller', description: 'Clase de prueba', category: 'workshop',
  date: new Date(Date.now() + 86400000 * 7).toISOString(), location: 'Sala CRUD', capacity: 10, price: 0, ...changes });

test('Pre-entrega 6: creación valida fecha, campos obligatorios, capacidad y precio', async () => {
  for (const changes of [{ date: new Date(0).toISOString() }, { capacity: 0 }, { capacity: -2 }, { capacity: 1.5 }, { price: -1 }, { price: '2' }, { price: null }, { title: '' }, { description: '' }, { category: '' }, { location: '' }]) {
    const result = await cookieApi('/api/events', 'POST', 'organizer', eventBody(changes));
    assert.equal(result.status, 400, JSON.stringify(changes));
  }
  assert.equal((await cookieApi('/api/events', 'POST', 'ana', eventBody())).status, 403);
  const result = await cookieApi('/api/events', 'POST', 'organizer', eventBody({ organizer: users.admin.id }));
  assert.equal(result.status, 201);
  assert.equal(result.body.payload.organizer, users.organizer.id);
  assert.equal(result.body.payload.price, 0);
  assert.equal(result.body.payload.status, 'draft');
  const saved = await Event.findById(result.body.payload._id);
  assert.ok(saved.organizer instanceof mongoose.Types.ObjectId);
});

test('Pre-entrega 6: PUT propio 200, ajeno 403, admin 200 y sin sesión 401', async () => {
  const e = await event();
  const path = '/api/events/' + e.id;
  assert.equal((await cookieApi(path, 'PUT', 'organizer', eventBody())).status, 200);
  assert.equal((await cookieApi(path, 'PUT', 'other', eventBody())).status, 403);
  assert.equal((await cookieApi(path, 'PUT', 'ana', eventBody())).status, 403);
  assert.equal((await cookieApi(path, 'PUT', undefined, eventBody())).status, 401);
  assert.equal((await cookieApi(path, 'PUT', 'admin', eventBody({ price: 25 }))).status, 200);
  assert.equal((await cookieApi(path, 'PUT', 'admin', eventBody({ organizer: users.admin.id }))).status, 400);
  assert.equal((await Event.findById(e.id)).organizer.toString(), users.organizer.id);
});

test('Pre-entrega 6: estados, cancelación lógica y eventos cancelados inmutables', async () => {
  const e = await event({ status: 'draft' });
  const path = '/api/events/' + e.id;
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'other', { status: 'published' })).status, 403);
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'organizer', { status: 'invalid' })).status, 400);
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'organizer', { status: 'finished' })).status, 409);
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'organizer', { status: 'published' })).status, 200);
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'admin', { status: 'cancelled' })).status, 200);
  assert.equal((await cookieApi(path + '/status', 'PATCH', 'admin', { status: 'published' })).status, 409);
  assert.equal((await cookieApi(path, 'PUT', 'admin', eventBody())).status, 409);
  assert.equal((await cookieApi(path, 'PATCH', 'admin', { title: 'No permitido' })).status, 409);
  assert.equal((await Event.findById(e.id)).status, 'cancelled');
});

test('Pre-entrega 6: finalizados por fecha o estado no pueden publicarse', async () => {
  for (const changes of [{ status: 'finished' }, { date: new Date(Date.now() - 10000), status: 'draft' }]) {
    const e = await event(changes);
    assert.equal((await cookieApi('/api/events/' + e.id + '/status', 'PATCH', 'admin', { status: 'published' })).status, 409);
  }
  const ended = await event({ date: new Date(Date.now() - 10000) });
  assert.equal((await cookieApi('/api/events/' + ended.id + '/status', 'PATCH', 'organizer', { status: 'finished' })).status, 200);
});

test('Pre-entrega 6: filtros combinados, segunda página, orden y totales', async () => {
  const location = 'Filtro exclusivo M6';
  const start = Date.now() + 86400000 * 20;
  for (let i = 0; i < 12; i++) await event({ category: 'workshop', location, date: new Date(start + i * 86400000), price: i });
  await event({ category: 'workshop', location, status: 'draft' });
  await event({ category: 'otro', location });
  const query = '/api/events?status=published&category=workshop&page=2&limit=5&location=' + encodeURIComponent(location) + '&sort=date';
  const result = await cookieApi(query);
  assert.equal(result.status, 200);
  assert.deepEqual({ ...result.body, data: [] }, { data: [], page: 2, limit: 5, total: 12, totalPages: 3 });
  assert.deepEqual(result.body.data.map(e => e.price), [5, 6, 7, 8, 9]);
  const range = await cookieApi(query + '&dateFrom=' + encodeURIComponent(new Date(start + 2 * 86400000).toISOString()) + '&dateTo=' + encodeURIComponent(new Date(start + 6 * 86400000).toISOString()));
  assert.equal(range.body.total, 5);
  assert.equal(range.body.data.length, 0);
  const descending = await cookieApi('/api/events?location=' + encodeURIComponent(location) + '&sort=-price&limit=2');
  assert.deepEqual(descending.body.data.map(e => e.price), [11, 10]);
});

test('Pre-entrega 6: rechaza paginación/filtros inválidos sin errores 500', async () => {
  for (const query of ['page=0','page=1.5','limit=101','sort=password','status=invalid','category[$ne]=x','dateFrom=no-es-fecha','dateFrom=2030-02-01&dateTo=2030-01-01','location=']) {
    assert.equal((await cookieApi('/api/events?' + query)).status, 400, query);
  }
});

test('Pre-entrega 6: detalle público y evento inexistente 404', async () => {
  const e = await event();
  const result = await cookieApi('/api/events/' + e.id);
  assert.equal(result.status, 200);
  assert.equal(result.body.payload._id, e.id);
  assert.equal(typeof result.body.payload.organizer, 'string');
  assert.equal(result.body.payload.bookingVersion, undefined);
  assert.equal((await cookieApi('/api/events/' + new mongoose.Types.ObjectId())).status, 404);
  assert.equal((await cookieApi('/api/events/invalid')).status, 400);
});

test('Pre-entrega 6: capacidad no baja de las reservas activas y cancelados no cuentan', async () => {
  const e = await event({ capacity: 3 });
  const ticket = await enroll(e, 'ana', 2);
  assert.equal(ticket.status, 201);
  assert.equal((await cookieApi('/api/events/' + e.id, 'PUT', 'organizer', eventBody({ capacity: 1 }))).status, 409);
  await api('/api/tickets/' + ticket.body.payload._id + '/cancel', 'PATCH', tokens.ana);
  assert.equal((await cookieApi('/api/events/' + e.id, 'PUT', 'organizer', eventBody({ capacity: 1 }))).status, 200);
});

test('Pre-entrega 6: reducir capacidad y reservar simultáneamente conserva los cupos', async () => {
  const e = await event({ capacity: 2 });
  const results = await Promise.all([enroll(e, 'bob', 2), cookieApi('/api/events/' + e.id, 'PUT', 'organizer', eventBody({ capacity: 1 }))]);
  assert.ok(results.every(result => [200, 201, 409].includes(result.status)));
  assert.equal(results.filter(result => result.status === 409).length, 1);
  const saved = await Event.findById(e.id);
  const tickets = await Ticket.find({ event: e.id, status: { $in: ['confirmed', 'pending'] } });
  assert.ok(tickets.reduce((sum, ticket) => sum + ticket.quantity, 0) <= saved.capacity);
});

async function cookieApi(path, method = 'GET', key, body) {
  const response = await fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(key ? { Cookie: 'currentUser=' + tokens[key] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('Pre-entrega 5: crear con cookie user 403; organizer/admin 201; sin sesión 401', async () => {
  const data = { title: 'Roles', description: 'Test', category: 'test', location: 'Sala', date: new Date(Date.now() + 86400000).toISOString(), capacity: 2, status: 'published' };
  const forbidden = await cookieApi('/api/events', 'POST', 'ana', data);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.message, 'No tenés permisos para realizar esta acción');
  for (const key of ['organizer', 'admin']) assert.equal((await cookieApi('/api/events', 'POST', key, data)).status, 201);
  const absent = await cookieApi('/api/events', 'POST', undefined, data);
  assert.deepEqual(absent, { status: 401, body: { status: 'error', message: 'No autenticado' } });
});

test('Pre-entrega 5: usuarios solo admin, paginados, sin password ni hashes', async () => {
  for (const key of ['ana', 'organizer']) assert.equal((await cookieApi('/api/users', 'GET', key)).status, 403);
  assert.equal((await cookieApi('/api/users')).status, 401);
  const result = await cookieApi('/api/users?limit=2', 'GET', 'admin');
  assert.equal(result.status, 200);
  assert.equal(result.body.payload.length, 2);
  assert.ok(result.body.pagination.total >= 5);
  for (const user of result.body.payload) assert.deepEqual(Object.keys(user).sort(), ['_id','first_name','last_name','email','role'].sort());
  assert.equal((await cookieApi('/api/users?limit=101', 'GET', 'admin')).status, 400);
});

test('Pre-entrega 5: editar propio, rechazar ajeno/user y permitir admin', async () => {
  const e = await event();
  const path = '/api/events/' + e.id;
  assert.equal((await cookieApi(path, 'PATCH', 'organizer', { title: 'Editado' })).status, 200);
  assert.equal((await cookieApi(path, 'PATCH', 'other', { title: 'Ajeno' })).status, 403);
  assert.equal((await cookieApi(path, 'PATCH', 'ana', { title: 'User' })).status, 403);
  assert.equal((await cookieApi(path, 'PATCH', undefined, { title: 'Sin sesión' })).status, 401);
  assert.equal((await cookieApi(path, 'PATCH', 'admin', { title: 'Admin' })).status, 200);
  assert.equal((await cookieApi(path, 'PATCH', 'organizer', { organizer: users.other.id })).status, 400);
  assert.equal((await cookieApi(path, 'PATCH', 'organizer', { capacity: 1 })).status, 400);
  assert.equal((await cookieApi('/api/events/' + new mongoose.Types.ObjectId(), 'PATCH', 'admin', { title: 'Nada' })).status, 404);
  const stored = await Event.findById(e.id);
  assert.equal(stored.title, 'Admin');
  assert.equal(stored.organizer.toString(), users.organizer.id);
});

test('Pre-entrega 5: cancelar requiere propietario/admin y bloquea nuevas reservas', async () => {
  const e = await event();
  const registration = await enroll(e);
  const path = '/api/events/' + e.id + '/cancel';
  assert.equal((await cookieApi(path, 'PATCH', 'other')).status, 403);
  assert.equal((await cookieApi(path, 'PATCH', 'ana')).status, 403);
  assert.equal((await cookieApi(path, 'PATCH')).status, 401);
  const cancelled = await cookieApi(path, 'PATCH', 'organizer');
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.payload.status, 'cancelled');
  assert.equal((await enroll(e, 'bob')).status, 409);
  assert.ok(await Ticket.findById(registration.body.payload._id));
  assert.equal((await cookieApi(path, 'PATCH', 'admin')).status, 409);
  const another = await event();
  assert.equal((await cookieApi('/api/events/' + another.id + '/cancel', 'PATCH', 'admin')).status, 200);
});

test('Pre-entrega 3: registro, cookie HttpOnly, current, logout y 401', async () => {
  const credentials = { email: 'cookie@example.test', password: 'CookiePrueba123' };
  assert.equal((await api('/api/sessions/register', 'POST', undefined, { ...credentials, first_name: 'Cookie', last_name: 'Test' })).status, 201);
  const response = await fetch(base + '/api/sessions/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /currentUser=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=3600/);
  const { config } = await import('../src/config/env.config.js');
  assert.equal(/; Secure/i.test(setCookie), config.nodeEnv === 'production');
  const body = await response.json();
  const payload = jwt.verify(body.payload.token, secret);
  assert.equal(payload.email, credentials.email);
  assert.equal(payload.role, 'user');
  assert.equal(payload.id, body.payload.user.id);
  assert.equal(payload.password, undefined);
  const cookieHeader = setCookie.split(';')[0];
  const current = await fetch(base + '/api/sessions/current', { headers: { Cookie: cookieHeader } });
  assert.equal(current.status, 200);
  assert.deepEqual((await current.json()).payload, { id: payload.id, email: credentials.email, role: 'user' });
  const logout = await fetch(base + '/api/sessions/logout', { method: 'POST', headers: { Cookie: cookieHeader } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /currentUser=;/);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
  assert.equal((await fetch(base + '/api/sessions/current')).status, 401);
});

test('Pre-entrega 3: email inexistente y password incorrecto tienen el mismo error', async () => {
  for (const credentials of [{ email: 'missing@example.test', password: 'Password123' }, { email: users.ana.email, password: 'incorrecta' }]) {
    const response = await api('/api/sessions/login', 'POST', undefined, credentials);
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { status: 'error', message: 'Credenciales inválidas' });
  }
  assert.equal((await api('/api/sessions/login', 'POST', undefined, {})).status, 400);
});

test('Pre-entrega 4: Passport acepta cookie en tickets y consulta el rol vigente', async () => {
  const response = await fetch(base + '/api/tickets/my-tickets', { headers: { Cookie: 'currentUser=' + tokens.ana } });
  assert.equal(response.status, 200);
  for (const ticket of (await response.json()).payload) assert.equal(ticket.user, users.ana.id);
  const e = await event();
  const forbidden = await fetch(base + '/api/events/' + e.id + '/tickets', { headers: { Cookie: 'currentUser=' + tokens.ana } });
  assert.equal(forbidden.status, 403);
  assert.equal((await fetch(base + '/api/tickets/my-tickets', { headers: { Cookie: 'currentUser=manipulado' } })).status, 401);
});

test('Pre-entrega 3: current rechaza cookie ausente, manipulada, vencida y solo Bearer', async () => {
  const expired = jwt.sign({ id: users.ana.id, email: users.ana.email, role: 'user' }, secret, { expiresIn: -1, issuer: 'eventhub', audience: 'eventhub-api' });
  for (const headers of [{}, { Cookie: 'currentUser=invalid' }, { Cookie: 'currentUser=' + expired }, { Authorization: 'Bearer ' + tokens.ana }]) {
    const response = await fetch(base + '/api/sessions/current', { headers });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { status: 'error', message: 'No autenticado' });
  }
});

test('Pre-entrega 3: expiración configurable y cookie Secure solo en producción', async () => {
  const { config } = await import('../src/config/env.config.js');
  const previous = { jwtExpiresIn: config.jwtExpiresIn, nodeEnv: config.nodeEnv };
  try {
    config.jwtExpiresIn = '2h';
    for (const nodeEnv of ['development', 'production']) {
      config.nodeEnv = nodeEnv;
      const response = await fetch(base + '/api/sessions/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: users.ana.email, password: 'PruebaSegura123' }) });
      assert.equal(/; Secure/i.test(response.headers.get('set-cookie')), nodeEnv === 'production');
      const payload = jwt.verify((await response.json()).payload.token, secret);
      assert.equal(payload.exp - payload.iat, 7200);
    }
  } finally { Object.assign(config, previous); }
});

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
  const data = { title: 'Nuevo', description: 'Test', category: 'test', date: new Date(Date.now() + 86400000).toISOString(), location: 'Salón', capacity: 2, status: 'published', organizer: users.other.id };
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

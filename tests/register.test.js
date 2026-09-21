import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { connectDatabase } from '../src/config/database.js';
import { comparePassword } from '../src/utils/hash.js';

let database;
let server;
let base;
before(async () => {
  // MongoDB real, temporal y aislado. Nunca usa MONGO_URL ni Atlas.
  database = await MongoMemoryServer.create();
  await connectDatabase(database.getUri('eventhub_tests'));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
const valid = { first_name: 'Ana', last_name: 'Pérez', email: 'Ana@Mail.com ', password: 'Secreta123' };
async function register(body) {
  const response = await fetch(base + '/api/sessions/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
test('Registro 201: normaliza email, persiste bcrypt, oculta password e ignora role', async () => {
  const result = await register({ ...valid, role: 'admin' });
  assert.equal(result.status, 201);
  assert.deepEqual(Object.keys(result.body.payload).sort(), ['id', 'first_name', 'last_name', 'email', 'role'].sort());
  assert.equal(result.body.payload.email, 'ana@mail.com');
  assert.equal(result.body.payload.role, 'user');
  assert.equal(result.body.status, 'success');
  const saved = await User.findById(result.body.payload.id).select('+password');
  assert.notEqual(saved.password, valid.password);
  assert.match(saved.password, /^\$2[aby]\$12\$/);
  assert.equal(await comparePassword(valid.password, saved.password), true);
  assert.equal(await comparePassword('Incorrecta123', saved.password), false);
  assert.equal(saved.role, 'user');
  assert.equal('password' in saved.toJSON(), false);
  assert.equal((await User.findById(saved._id)).password, undefined);
});
test('Campos faltantes, vacíos o con tipos incorrectos: 400', async () => {
  for (const field of ['first_name', 'last_name', 'email', 'password']) {
    for (const value of [undefined, '', '   ', 12, {}, null]) {
      const result = await register({ ...valid, [field]: value });
      assert.equal(result.status, 400);
      assert.equal(result.body.message, 'Faltan campos obligatorios');
    }
  }
});
test('Email inválido y contraseñas cortas o mayores a 72 bytes: 400', async () => {
  for (const email of ['ana', 'ana@', 'a@@mail.com', 'ana @mail.com']) {
    assert.equal((await register({ ...valid, email })).status, 400);
  }
  for (const password of ['corta', 'a'.repeat(73), 'á'.repeat(37)]) {
    assert.equal((await register({ ...valid, password })).status, 400);
  }
});
test('Email duplicado con distinta capitalización y espacios: 409', async () => {
  const result = await register({ ...valid, email: '  ANA@MAIL.COM  ' });
  assert.equal(result.status, 409);
  assert.equal(result.body.message, 'El email ya está registrado');
  assert.equal(await User.countDocuments({ email: 'ana@mail.com' }), 1);
});
test('Dos registros simultáneos: uno 201, otro 409; un único usuario', async () => {
  const data = { ...valid, email: 'race@mail.com' };
  const results = await Promise.all([register(data), register(data)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: data.email }), 1);
});
test('JSON malformado: 400 sin detalles internos', async () => {
  const response = await fetch(base + '/api/sessions/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: 'error', message: 'El cuerpo debe ser un JSON válido' });
});
test('Modelo limita roles y conserva user por defecto', async () => {
  const data = { ...valid, password: 'hash solo para validación de esquema' };
  assert.equal(new User(data).role, 'user');
  await assert.rejects(new User({ ...data, role: 'root' }).validate(), error => Boolean(error.errors.role));
});
test('Rutas de la primera entrega siguen disponibles', async () => {
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/events')).json(), { status: 'success', data: [], page: 1, limit: 20, total: 0, totalPages: 0 });
});



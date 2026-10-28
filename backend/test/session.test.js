import test from 'node:test';
import assert from 'node:assert/strict';
import { issueSession, requireCustomer } from '../services/sessionService.js';

function authenticate(token) {
  const request = { headers: { authorization: `Bearer ${token}` } };
  let error;
  requireCustomer(request, {}, result => { error = result; });
  return { customer: request.customer, error };
}

test('sesiones: tokens impredecibles, datos sin contraseña, token inventado y empleado rechazados', () => {
  const customer = { id_cliente: 1, nombre: 'Test', password: 'fixture-only' };
  const firstToken = issueSession(customer);
  const secondToken = issueSession(customer);
  assert.notEqual(firstToken, secondToken);
  assert.match(firstToken, /^[0-9a-f]{64}$/);
  assert.equal(authenticate(firstToken).customer.password, undefined);
  assert.equal(authenticate('lesgo_token_cli_1_1234567').error.status, 401);
  assert.equal(authenticate(issueSession({ id_empleado: 1 })).error.status, 403);
});

test('sesiones: vencimiento y bloqueo explícito en producción', t => {
  const now = Date.now();
  const token = issueSession({ id_cliente: 1 });
  t.mock.method(Date, 'now', () => now + 9 * 60 * 60 * 1000);
  assert.equal(authenticate(token).error.status, 401);

  const previousEnvironment = process.env.NODE_ENV;
  t.after(() => {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });
  process.env.NODE_ENV = 'production';
  assert.equal(authenticate(token).error.code, 'AUTH_NOT_CONFIGURED');
});

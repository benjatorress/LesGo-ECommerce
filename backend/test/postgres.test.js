import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createPostgresOrderRepository } from '../repositories/postgresOrderRepository.js';

test('PostgreSQL aislado: commit cabecera/líneas/outbox, GET, rollback y concurrencia', { skip: !process.env.PG_TEST_URL }, async () => {
  const url = new URL(process.env.PG_TEST_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/lesgo_isolated_test') {
    throw new Error('PG_TEST_URL solo acepta localhost y la base lesgo_isolated_test; nunca la BD compartida.');
  }
  const pool = new pg.Pool({ connectionString: url.toString() });
  try {
    const identity = await pool.query('SELECT current_database() AS name');
    assert.equal(identity.rows[0].name, 'lesgo_isolated_test');
    await pool.query('CREATE SCHEMA IF NOT EXISTS ecommerce_ventas');
    const schemaSql = await readFile(new URL('../sql/001_pedidos_review.sql', import.meta.url), 'utf8');
    await pool.query(schemaSql);
    const statements = [];
    const instrumentedPool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          query: (...args) => {
            statements.push(args[0]);
            return client.query(...args);
          },
          release: () => client.release()
        };
      }
    };
    const repo = createPostgresOrderRepository(instrumentedPool);
    const suffix = `${Date.now()}-${Math.random()}`;
    const order = {
      id_cliente: 91,
      monto_total: 20,
      estado: 'Pendiente',
      direccion_entrega: 'Test',
      comuna_entrega: 'Test',
      ciudad_entrega: 'Test',
      telefono_contacto: '1234',
      metodo_pago: 'tarjeta',
      observaciones: ''
    };
    const lines = [{
      id_producto: '00000000-0000-4000-8000-000000000001',
      cantidad: 2,
      precio_unitario: 10
    }];
    const event = {
      key: `isolated-${suffix}`,
      fingerprint: 'hash',
      payload: { cliente: { id_cliente: 91 } }
    };
    const results = await Promise.all([
      repo.create(order, lines, event),
      repo.create(order, lines, event)
    ]);
    assert.equal(results[0].pedido.id_pedido, results[1].pedido.id_pedido);
    const saved = await repo.get(91, results[0].pedido.id_pedido);
    assert.equal(saved.pedido.estado, 'Pendiente');
    assert.equal(saved.detalle[0].precio_unitario, 10);
    assert.equal(saved.event.status, 'pending');
    assert.equal(await repo.get(92, saved.pedido.id_pedido), null);
    await repo.markCrm(saved.pedido.id_pedido, 'synced');
    assert.equal((await repo.findByKey(91, event.key)).event.status, 'synced');
    const statementsBeforeList = statements.length;
    const history = await repo.list(91);
    const historyStatements = statements.slice(statementsBeforeList);
    assert.equal(historyStatements.length, 2);
    assert.ok(historyStatements.every(sql => !sql.includes('payload')));
    const summary = history.find(pedido => pedido.id_pedido === saved.pedido.id_pedido);
    assert.equal(summary.total_items, 2);
    assert.equal(summary.crm_status, 'synced');
    assert.equal('payload' in summary, false);
    const count = (await repo.list(91)).length;
    const invalidLines = [{ ...lines[0], cantidad: -1 }];
    const failedEvent = { ...event, key: `rollback-${suffix}` };
    await assert.rejects(repo.create(order, invalidLines, failedEvent));
    assert.equal((await repo.list(91)).length, count);
    assert.equal(await repo.findByKey(91, `rollback-${suffix}`), null);
  } finally {
    await pool.end();
  }
});

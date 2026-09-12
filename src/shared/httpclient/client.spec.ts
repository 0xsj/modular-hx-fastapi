import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { Client } from './index.js';
import { traceRef } from '../telemetry/index.js';
it('executes bounded loopback attempts without redirect or status rewriting', async () => {
  const server = createServer((req, res) => {
    switch (req.url) {
      case '/status':
        res.writeHead(409).end('{"ok":false}');
        break;
      case '/redirect':
        res.writeHead(302, { location: '/status' }).end();
        break;
      case '/large':
        res.end('x'.repeat(100));
        break;
      case '/slow':
        break;
      case '/trace':
        res.end(req.headers.traceparent);
        break;
      default:
        res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('fixture');
  const made = Client.create({
    origin: `http://127.0.0.1:${address.port}`,
    timeoutMs: 50,
    maxRequest: 64,
    maxResponse: 64,
  });
  if (!made.ok) throw Error('fixture');
  const c = made.value;
  try {
    for (const [path, status] of [
      ['/status', 409],
      ['/redirect', 302],
    ] as const) {
      const r = await c.do({ method: 'GET', path });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.status).toBe(status);
    }
    for (const [path, code] of [
      ['/large', 'httpclient.response_too_large'],
      ['/slow', 'httpclient.timeout'],
      ['//evil/x', 'httpclient.request'],
      ['/\\evil', 'httpclient.request'],
    ]) {
      const r = await c.do({ method: 'GET', path });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.type).toBe(code);
    }
    const trace = traceRef('1'.repeat(32), '2'.repeat(16), true);
    if (!trace.ok) throw Error('fixture');
    const r = await c.do({ method: 'GET', path: '/trace', trace: trace.value });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(Buffer.from(r.value.body).toString()).toBe(
        '00-' + '1'.repeat(32) + '-' + '2'.repeat(16) + '-01',
      );
    const cancel = new AbortController();
    cancel.abort();
    const canceled = await c.do(
      { method: 'GET', path: '/status' },
      cancel.signal,
    );
    expect(canceled.ok).toBe(false);
    if (!canceled.ok) expect(canceled.error.kind).toBe('canceled');
    c.close();
    const closed = await c.do({ method: 'GET', path: '/status' });
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.error.type).toBe('httpclient.closed');
  } finally {
    c.close();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

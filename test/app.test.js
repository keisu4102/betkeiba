const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
let server, base;
test.before(async () => { server = app.listen(0); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());
test('health endpoint responds without exposing secrets', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(['connected', 'disconnected'].includes(body.database));
});
test('protected wallet requires login', async () => {
  const res = await fetch(base + '/api/wallet');
  assert.equal(res.status, 401);
});
test('auth status endpoint is public and starts logged out', async () => {
  const res = await fetch(base + '/api/auth/me');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).user, null);
});

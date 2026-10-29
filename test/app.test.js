const test = require("node:test");
const assert = require("node:assert");
const server = require("../server");
let base;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = "http://localhost:" + server.address().port;
});

test.after(() => server.close());

test("health check says ok", async () => {
  const res = await fetch(base + "/health");
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: "ok" });
});

test("can add an item / horse runner", async () => {
  const res = await fetch(base + "/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Folkqueen - Test Runner" }),
  });
  assert.strictEqual(res.status, 201);
});

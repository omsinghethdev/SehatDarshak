import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// The demo hospital data and the route engine are shared with the frontend mock (which cannot
// import server files). Both copies must be identical, so mock mode and the API never disagree.
const root = new URL('../../', import.meta.url);

for (const [server, client] of [
  ['server/src/modules/navigation/demoHospital.data.js', 'client/src/features/navigation/demoHospital.data.js'],
  ['server/src/modules/navigation/routeEngine.js', 'client/src/features/navigation/routeEngine.js'],
]) {
  test(`${client} is identical to ${server}`, async () => {
    const [a, b] = await Promise.all([readFile(new URL(server, root), 'utf8'), readFile(new URL(client, root), 'utf8')]);
    assert.ok(a === b, `Copy ${server} to ${client} after editing it.`);
  });
}

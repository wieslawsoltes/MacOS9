import test from 'node:test';
import assert from 'node:assert/strict';
import { DiskStore } from '../packages/storage/index.js';

const storage = () => ({ values: new Map(), getItem(k) { return this.values.get(k) ?? null; }, setItem(k,v) { this.values.set(k,v); } });
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
globalThis.window = new EventTarget();

class MemoryDiskStore extends DiskStore {
  constructor(local = null) { super(); this.local = local; this.writes = []; }
  async localGet() { return this.local; }
  localPut(value) { this.local = structuredClone(value); this.writes.push(this.local); return Promise.resolve(); }
}
const response = (value, status=200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('flush drains edits queued while an earlier upload is in flight', async t => {
  const original = fetch, first = deferred(), bodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); bodies.push(body);
    return bodies.length === 1 ? first.promise : response({ version: 2 });
  };
  const store = new MemoryDiskStore();
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  await store.schedule({ value: 'first' });
  const saving = store.flush();
  await new Promise(resolve => setImmediate(resolve));
  await store.schedule({ value: 'second' });
  first.resolve(response({ version: 1 }));
  assert.equal(await saving, true);
  assert.deepEqual(bodies.map(x => x.expectedVersion), [0,1]);
  assert.deepEqual(bodies.map(x => x.payload.value), ['first','second']);
  assert.equal(store.pending, null);
  assert.equal(store.local.payload.value, 'second');
  assert.equal(store.local.dirty, false);
});

test('version conflicts retain the local journal and do not overwrite the cloud', async t => {
  const original = fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return response({ error: 'Conflict' }, 409); };
  const store = new MemoryDiskStore(); store.version = 4;
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  await store.schedule({ text: 'local edit' });
  assert.equal(await store.flush(), false);
  assert.equal(store.conflict, true);
  assert.equal(store.local.dirty, true);
  assert.equal(store.local.payload.text, 'local edit');
  await store.flush(); assert.equal(calls, 1);
});

test('reload preserves a dirty journal when a newer cloud version exists', async t => {
  const original = fetch;
  globalThis.fetch = async () => response({ version: 8, payload: { text: 'remote' } });
  const store = new MemoryDiskStore({ version: 7, dirty: true, payload: { text: 'local' } });
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  assert.deepEqual(await store.load(), { text: 'local' });
  assert.equal(store.version, 7);
  assert.equal(store.conflict, true);
});

test('offline failures retain all edits for the next synchronization', async t => {
  const original = fetch;
  globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
  const store = new MemoryDiskStore();
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  await store.schedule({ text: 'offline' });
  assert.equal(await store.flush(), false);
  assert.equal(store.local.payload.text, 'offline');
  assert.equal(store.local.dirty, true);
  assert.equal(store.status, 'Saved on this device');
  globalThis.fetch = async () => response({ version: 1 });
  assert.equal(await store.flush(), true);
  assert.equal(store.local.dirty, false);
});

test('reading a conflict candidate cannot enable a stale overwrite', async t => {
  const original = fetch;
  globalThis.fetch = async () => response({ version: 9, payload: { text: 'remote' } });
  const store = new MemoryDiskStore();
  store.version = 3; store.conflict = true; store.pending = { text: 'local' };
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  assert.equal((await store.resolveConflict()).version, 9);
  assert.equal(store.version, 3);
  assert.equal(store.conflict, true);
  assert.deepEqual(store.pending, { text: 'local' });
  assert.equal(await store.flush(), false);
});

test('unavailable local and cloud storage never reports a durable save', async t => {
  const original = fetch;
  globalThis.fetch = async () => { throw new Error('Offline'); };
  const store = new MemoryDiskStore();
  store.localPut = async () => false;
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  let warning = false; store.on('unpersisted', () => { warning = true; });
  assert.equal(await store.schedule({ text: 'only in memory' }), false);
  assert.equal(await store.flush(), false);
  assert.match(store.status, /Unsaved changes/);
  assert.equal(warning, true);
  assert.equal(store.pending.text, 'only in memory');
});

test('cloud commit remains successful when the local cache is unavailable', async t => {
  const original = fetch;
  globalThis.fetch = async () => response({ version: 1 });
  const store = new MemoryDiskStore(); store.localPut = async () => false;
  t.after(() => { globalThis.fetch = original; store.dispose(); });
  await store.schedule({ text: 'cloud copy' });
  assert.equal(await store.flush(), true);
  assert.equal(store.version, 1);
  assert.equal(store.status, 'All changes saved');
});

test('adopting a confirmed cloud snapshot discards only the old pending branch', async t => {
  const store = new MemoryDiskStore();
  t.after(() => store.dispose());
  store.version = 1; store.conflict = true; store.pending = { text: 'old' };
  await store.adoptCloudSnapshot({ version: 2, payload: { text: 'chosen' } });
  assert.equal(store.pending, null);
  assert.equal(store.conflict, false);
  assert.equal(store.version, 2);
  assert.equal(store.local.payload.text, 'chosen');
  assert.equal(store.local.dirty, false);
});

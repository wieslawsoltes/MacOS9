import { env } from 'cloudflare:workers';
import { VirtualFileSystem } from '@platinum/core/filesystem';
const MAX_SNAPSHOT = 32 * 1024 * 1024;
async function diskKey(request: Request) {
  const id = request.headers.get('x-platinum-disk');
  if (!id || !/^[a-zA-Z0-9-]{12,80}$/.test(id)) throw new Error('Invalid disk identifier');
  const owner = request.headers.get('oai-authenticated-user-id');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner ? `user:${owner}:primary` : `device:${id}`));
  return Array.from(new Uint8Array(bytes), x => x.toString(16).padStart(2, '0')).join('');
}
function bindings() {
  const bindings = env as unknown as { DB?: D1Database; FILES?: R2Bucket };
  if (!bindings.DB || !bindings.FILES) throw new Error('Disk storage is not available.');
  return { db: bindings.DB, files: bindings.FILES };
}
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
export async function GET(request: Request) {
  try {
    const id = await diskKey(request), { db, files } = bindings();
    const row = await db.prepare('SELECT version, object_key FROM platinum_disks WHERE id = ?').bind(id).first<{version: number;object_key: string}>();
    if (!row) return json({ version: 0, payload: null });
    const object = await files.get(row.object_key);
    if (!object) return json({ error: 'The disk snapshot is temporarily unavailable.' }, 503);
    return json({ version: row.version, payload: await object.json() });
  } catch (error) { console.error('Read disk:', error instanceof Error ? error.message : error); return json({ error: 'The cloud disk is unavailable. Your local copy is retained.' }, 503); }
}
export async function PUT(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Invalid origin' }, 403);
  if (Number(request.headers.get('content-length') || 0) > MAX_SNAPSHOT) return json({ error: 'Disk snapshot is too large.' }, 413);
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const id = await diskKey(request), { db, files } = bindings();
    const raw = await request.text();
    if (raw.length > MAX_SNAPSHOT) return json({ error: 'Disk snapshot is too large.' }, 413);
    const { expectedVersion, payload } = JSON.parse(raw);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || !VirtualFileSystem.validate(payload?.filesystem).valid) return json({ error: 'Invalid disk snapshot.' }, 400);
    const key = `disks/${id}/${crypto.randomUUID()}.json`, now = Date.now();
    await files.put(key, JSON.stringify(payload), { httpMetadata: { contentType: 'application/json' } });
    cleanup = async () => { await files.delete(key); };
    const previous = await db.prepare('SELECT object_key FROM platinum_disks WHERE id = ?').bind(id).first<{object_key: string}>();
    const result = expectedVersion === 0
      ? await db.prepare('INSERT INTO platinum_disks (id, version, object_key, updated) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, key, now).run()
      : await db.prepare('UPDATE platinum_disks SET version = version + 1, object_key = ?, updated = ? WHERE id = ? AND version = ?').bind(key, now, id, expectedVersion).run();
    if (!result.meta.changes) { await files.delete(key); return json({ error: 'Disk changed in another session.' }, 409); }
    cleanup = undefined; // The compare-and-swap committed this immutable object.
    if (previous) await files.delete(previous.object_key).catch(() => {});
    return json({ version: expectedVersion + 1 });
  } catch (error) { await cleanup?.().catch(() => {}); console.error('Save disk:', error instanceof Error ? error.message : error); return json({ error: 'The cloud disk is unavailable. Your local copy is retained.' }, 503); }
}

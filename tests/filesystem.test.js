import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualFileSystem } from '@platinum/core/filesystem';
import { createSeed } from '@platinum/core/seed';

const fresh = () => new VirtualFileSystem(createSeed());

test('seed disk is valid and application identifiers are unique', () => {
  const seed = createSeed();
  assert.deepEqual(VirtualFileSystem.validate(seed), { valid: true, errors: [] });
  assert.equal(new Set(seed.nodes.map(n => n.id)).size, seed.nodes.length);
});

test('a failed transaction rolls back every preceding edit', () => {
  const fs = fresh(), before = fs.export();
  assert.throws(() => fs.mutate('batch', () => {
    fs.create('documents', 'Temporary');
    fs.move('documents', 'pictures');
  }), /inside itself/);
  assert.deepEqual(fs.export(), before);
  assert.equal(fs.undoStack.length, 0);
});

test('aliases keep their target across rename and move', () => {
  const fs = fresh();
  const file = fs.create('documents', 'Draft', { content: 'hello' });
  const alias = fs.alias(file.id);
  fs.rename(file.id, 'Final');
  fs.move(file.id, 'extras');
  assert.equal(fs.resolve(alias.id).name, 'Final');
  assert.equal(fs.resolve(alias.id).parent, 'extras');
});

test('copy duplicates a complete tree with independent identities', () => {
  const fs = fresh();
  const folder = fs.create('documents', 'Project', { type: 'folder' });
  const file = fs.create(folder.id, 'Notes', { content: 'original' });
  const copy = fs.copy(folder.id, 'desktop');
  const copiedFile = fs.children(copy.id)[0];
  assert.notEqual(copiedFile.id, file.id);
  fs.write(copiedFile.id, 'changed');
  assert.equal(fs.get(file.id).content, 'original');
});

test('trash, put away, undo and redo preserve document content', () => {
  const fs = fresh();
  const file = fs.create('documents', 'Test', { content: 'saved' });
  fs.trash(file.id);
  assert.equal(fs.get(file.id).parent, 'trash');
  assert.equal(fs.search('Test').length, 0);
  fs.restore(file.id);
  assert.equal(fs.get(file.id).parent, 'documents');
  fs.undo();
  assert.equal(fs.get(file.id).parent, 'trash');
  fs.redo();
  assert.equal(fs.get(file.id).content, 'saved');
  assert.equal(fs.get(file.id).parent, 'documents');
});

test('cannot overwrite a folder or application as a text document', () => {
  const fs = fresh();
  assert.throws(() => fs.write('documents', 'oops'), /Choose a document/);
  assert.throws(() => fs.write('app-simpletext', 'oops'), /Choose a document/);
  assert.equal(fs.get('documents').type, 'folder');
});

test('locked files reject edits, moves and deletion', () => {
  const fs = fresh();
  const file = fs.create('documents', 'Locked', { locked: true });
  for (const operation of [() => fs.write(file.id, 'x'), () => fs.rename(file.id, 'x'), () => fs.move(file.id, 'desktop'), () => fs.remove(file.id)]) assert.throws(operation, /locked/);
});

test('case-insensitive sibling names reject duplicates', () => {
  const fs = fresh();
  fs.create('documents', 'Report');
  assert.throws(() => fs.create('documents', 'REPORT'), /already exists/);
  assert.equal(fs.uniqueName('documents', 'Report'), 'Report 2');
});

test('snapshot validation rejects cycles, missing parents and duplicate IDs', () => {
  for (const corrupt of [
    seed => { seed.nodes.find(n => n.id === 'documents').parent = 'pictures'; },
    seed => { seed.nodes.find(n => n.id === 'documents').parent = 'missing'; },
    seed => { seed.nodes.push({ ...seed.nodes[0] }); },
  ]) {
    const seed = createSeed(); corrupt(seed);
    assert.equal(VirtualFileSystem.validate(seed).valid, false);
    assert.throws(() => new VirtualFileSystem(seed), /cannot be opened/);
  }
});

test('content search honors folder scope and excludes trashed descendants', () => {
  const fs = fresh();
  const folder = fs.create('documents', 'Archive', { type: 'folder' });
  fs.create(folder.id, 'Memo', { content: 'orbital verification' });
  assert.equal(fs.search('orbital', { contents: true, scope: 'documents' }).length, 1);
  assert.equal(fs.search('orbital', { contents: true, scope: 'extras' }).length, 0);
  fs.trash(folder.id);
  assert.equal(fs.search('orbital', { contents: true }).length, 0);
});

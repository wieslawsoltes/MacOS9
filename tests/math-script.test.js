import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression, CalculatorEngine } from '../packages/apps-utilities/math.js';
import { compileScript, runScript } from '../packages/apps-utilities/scripting.js';
import { VirtualFileSystem } from '@platinum/core/filesystem';
import { createSeed } from '@platinum/core/seed';

test('graph expressions implement precedence, powers and implicit multiplication', () => {
  assert.equal(compileExpression('2+3*4')(), 14);
  assert.equal(compileExpression('-2^2')(), -4);
  assert.equal(compileExpression('2^3^2')(), 512);
  assert.equal(compileExpression('2x + 3(x+1)')(4), 23);
  assert.equal(compileExpression('x^2+y^2')(3,4), 25);
  assert.ok(Math.abs(compileExpression('sin(pi/2)')()-1) < 1e-10);
});

test('graph expressions reject code, unknown names and excessive recursion', () => {
  for (const source of ['window.location', 'constructor("alert(1)")', 'x;throw 1', 'unknown(x)', '1+'.repeat(300), '('.repeat(60)+'1'+')'.repeat(60)]) assert.throws(() => compileExpression(source));
});

test('calculator chaining, percent and repeated equals work', () => {
  const c = new CalculatorEngine();
  for (const key of ['2','+','3','=']) c.input(key);
  assert.equal(c.display, '5');
  c.input('='); assert.equal(c.display, '8');
  c.input('C');
  for (const key of ['2','0','0','+','1','0','%','=']) c.input(key);
  assert.equal(c.display, '220');
  c.input('C');
  for (const key of ['8','÷','0','=']) c.input(key);
  assert.equal(c.display, 'Error');
  c.input('7'); assert.equal(c.display, '7');
});

test('calculator memory and decimal input are independent of arithmetic state', () => {
  const c = new CalculatorEngine();
  for (const key of ['1','.','2','.','5','M+','3','M+','MR']) c.input(key);
  assert.equal(c.display, '4.25');
  c.input('MC'); c.input('MR'); assert.equal(c.display, '0');
});

test('AppleScript subset creates a Finder folder through shared filesystem services', async () => {
  const vfs = new VirtualFileSystem(createSeed());
  const os = { vfs, registry: new Map(), sound: { beep() {} }, async alert() {} };
  const source = vfs.get('sample-script').content;
  await runScript(source, os);
  assert.ok(vfs.children('desktop').some(n => n.type === 'folder' && n.name === 'My New Folder'));
});

test('scripts validate block pairing and enforce execution limits', async () => {
  assert.throws(() => compileScript('repeat 2 times\nend tell'), /unmatched/);
  assert.throws(() => compileScript('tell application "Finder"'), /missing end/);
  assert.throws(() => compileScript('do shell script "rm"'), /unsupported/);
  await assert.rejects(runScript('repeat 101 times\nbeep\nend repeat', { sound: { beep() {} } }), /at most 100/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runScript('beep', { sound: { beep() {} } }, { signal: controller.signal }), /stopped/);
});

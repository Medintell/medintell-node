import { test } from 'node:test';
import assert from 'node:assert';
import { MedIntell, MedIntellError } from '../src/index.js';

test('constructs and exposes resources', () => {
  const mi = new MedIntell({ apiKey: 'mi_live_test' });
  for (const r of ['organizations','facilities','departments','doctors','payers','patients','visits','ingest']) {
    assert.ok(mi[r], `missing resource ${r}`);
  }
  assert.equal(typeof mi.health, 'function');
  assert.equal(typeof mi.patients.iterate, 'function');
});

test('requires apiKey', () => {
  assert.throws(() => new MedIntell({}), MedIntellError);
});

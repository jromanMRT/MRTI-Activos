import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTeamviewerId, normalizeTeamviewerInput } from '../src/routes/teamviewer.js';

test('el ID de TeamViewer se guarda solo con dígitos', () => {
  assert.equal(normalizeTeamviewerId(' 1 234 567 890 '), '1234567890');
  assert.equal(normalizeTeamviewerId('123-456-789'), '123456789');
  assert.throws(() => normalizeTeamviewerId('abc'), /entre 6 y 12 dígitos/);
  assert.throws(() => normalizeTeamviewerId('12345'), /entre 6 y 12 dígitos/);
});

test('en una edición la contraseña vacía no se cambia', () => {
  assert.equal('password' in normalizeTeamviewerInput({ password: '' }, { partial: true }), false);
  assert.deepEqual(normalizeTeamviewerInput({ alias: '  Laptop ' }, { partial: true }), { alias: 'Laptop' });
  const full = normalizeTeamviewerInput({ teamviewer_id: '987 654 321', password: 'secreta', asset_uid: '' });
  assert.equal(full.teamviewer_id, '987654321');
  assert.equal(full.password, 'secreta');
  assert.equal(full.asset_uid, null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSapAssetCredentials } from '../src/integrations/sapClient.js';

test('extrae únicamente las cinco credenciales de remisión autorizadas', () => {
  assert.deepEqual(pickSapAssetCredentials({
    id: 4,
    center_code: 'TI-00004',
    win_password: 'win',
    ms_password: 'microsoft',
    password_mrt: 'mrt',
    password_corporativo: 'corporativo',
    db_password: 'dropbox',
    numero_serie: 'SERIE-PRIVADA',
  }), {
    win_password: 'win',
    ms_password: 'microsoft',
    password_mrt: 'mrt',
    password_corporativo: 'corporativo',
    db_password: 'dropbox',
  });
});

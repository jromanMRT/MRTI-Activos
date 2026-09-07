import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSapAssetCredentialChanges, pickSapAssetCredentials, pickSapAssetWritableFields } from '../src/integrations/sapClient.js';

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

test('normaliza cambios parciales sin revelar ni inventar otros secretos', () => {
  assert.deepEqual(normalizeSapAssetCredentialChanges({ win_password: 'Nueva clave', db_password: null }), {
    win_password: 'Nueva clave',
    db_password: null,
  });
  assert.deepEqual(normalizeSapAssetCredentialChanges({ ms_password: '' }), { ms_password: null });
});

test('rechaza payloads ambiguos o campos ajenos a las credenciales permitidas', () => {
  assert.throws(() => normalizeSapAssetCredentialChanges({}), /al menos una credencial/);
  assert.throws(() => normalizeSapAssetCredentialChanges({ password: 'no permitido' }), /no permitidos/);
  assert.throws(() => normalizeSapAssetCredentialChanges({ win_password: 123 }), /texto o null/);
  assert.throws(() => normalizeSapAssetCredentialChanges({ win_password: 'x'.repeat(256) }), /255/);
});

test('separa campos de la tabla principal de cuentas, antivirus y columnas locales', () => {
  assert.deepEqual(pickSapAssetWritableFields({
    center_code: 'TI-00001',
    marca: 'Dell',
    modelo: 'Latitude',
    garantia_hasta: '2027-01-01',
    win_usuario: 'usuario',
    av_comentario: 'ESET',
    portal_user_id: 'uuid-local',
  }), { marca: 'Dell', modelo: 'Latitude' });
});

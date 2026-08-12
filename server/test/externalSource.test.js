import test from 'node:test';
import assert from 'node:assert/strict';
import {
  externalSourceConfig,
  hasReadOnlyGrants,
  parseBoolean,
} from '../src/externalSource.js';

test('valida una configuración externa completa', () => {
  const config = externalSourceConfig({
    EXTERNAL_MYSQL_HOST: '192.0.2.10',
    EXTERNAL_MYSQL_PORT: '3307',
    EXTERNAL_MYSQL_USER: 'reader',
    EXTERNAL_MYSQL_PASSWORD: 'secret',
    EXTERNAL_MYSQL_DATABASE: 'assets_source',
    EXTERNAL_MYSQL_CONNECT_TIMEOUT_MS: '4000',
    EXTERNAL_MYSQL_SSL: 'true',
  });

  assert.equal(config.port, 3307);
  assert.equal(config.database, 'assets_source');
  assert.equal(config.connectTimeout, 4000);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test('rechaza configuración incompleta e identificadores inseguros', () => {
  assert.throws(() => externalSourceConfig({}), /Faltan variables/);
  assert.throws(() => externalSourceConfig({
    EXTERNAL_MYSQL_HOST: 'db',
    EXTERNAL_MYSQL_USER: 'reader',
    EXTERNAL_MYSQL_PASSWORD: 'secret',
    EXTERNAL_MYSQL_DATABASE: 'assets; DROP DATABASE source',
  }), /caracteres no permitidos/);
  assert.throws(() => parseBoolean('tal vez'), /booleano inválido/);
});

test('distingue permisos de lectura de privilegios de escritura', () => {
  assert.equal(hasReadOnlyGrants([
    "GRANT USAGE ON *.* TO `reader`@`10.%`",
    "GRANT SELECT, SHOW VIEW ON `source`.* TO `reader`@`10.%`",
  ]), true);
  assert.equal(hasReadOnlyGrants([
    "GRANT SELECT, INSERT, UPDATE ON `source`.* TO `admin`@`10.%`",
  ]), false);
  assert.equal(hasReadOnlyGrants([
    "GRANT ALL PRIVILEGES ON `source`.* TO `admin`@`10.%`",
  ]), false);
});

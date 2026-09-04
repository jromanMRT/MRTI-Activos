import test from 'node:test';
import assert from 'node:assert/strict';
import { mutationDescriptor, sanitizeAuditValue } from '../src/audit.js';

test('auditoría Activos redacta credenciales y datos sensibles', () => {
  assert.deepEqual(sanitizeAuditValue({ serial: 'ABC', api_key: 'key', clave_cifrado: 'clave', codigo_verificacion: '123', owner: { rfc: 'RFC' } }), { serial: 'ABC', api_key: '[REDACTADO]', clave_cifrado: '[REDACTADO]', codigo_verificacion: '[REDACTADO]', owner: { rfc: '[REDACTADO]' } });
});
test('auditoría Activos describe eliminaciones', () => {
  assert.deepEqual(mutationDescriptor('DELETE', '/api/activos/27'), { entityType: 'activos', entityId: '27', action: 'activos.deleted' });
});

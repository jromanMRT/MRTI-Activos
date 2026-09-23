import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseNotifications, noticeConfiguration, normalizeNoticeDays } from '../src/licenseAlerts.js';

test('los umbrales usan 30 días por defecto y respetan configuración activa', () => {
  assert.equal(normalizeNoticeDays(undefined), 30);
  assert.equal(normalizeNoticeDays('-1'), 30);
  assert.equal(normalizeNoticeDays('45'), 45);
  assert.equal(normalizeNoticeDays('99999'), 3650);
  assert.deepEqual(noticeConfiguration([
    { clave: 'antivirus', dias_aviso: 30, activo: 1 },
    { clave: 'o365', dias_aviso: 10, activo: 0 },
  ]), {
    antivirus: { active: true, days: 30 }, office365: { active: false, days: 10 }, fortigate: { active: true, days: 30 },
  });
});

test('cada licencia próxima genera aviso propio y las vencidas se agrupan', () => {
  const timestamp = '2026-09-23T12:00:00.000Z';
  const items = licenseNotifications({
    antivirus: [
      { id: 1, asset_uid: 'a', center_code: 'TI-1', fecha_vence: '2026-10-20', dias_restantes: 27 },
      { id: 2, asset_uid: 'b', center_code: 'TI-2', fecha_vence: '2026-09-01', dias_restantes: -22 },
      { id: 3, asset_uid: 'c', center_code: 'TI-3', fecha_vence: '2026-08-01', dias_restantes: -53 },
    ],
    office365: [{ id: 4, asset_uid: 'd', center_code: 'TI-4', fecha_vence: '2026-09-23', dias_restantes: 0 }],
    fortigate: [],
  }, timestamp);
  assert.equal(items.length, 3);
  assert.match(items.find((item) => item.kind === 'asset_license_overdue').title, /2 Antivirus vencidas/);
  assert.match(items.find((item) => item.id.includes(':a:')).message, /27 días.*20\/10\/2026/);
  assert.match(items.find((item) => item.id.includes(':d:')).message, /Vence hoy/);
  assert.ok(items.every((item) => item.timestamp === timestamp));
});

test('limita avisos individuales y conserva acceso a la lista completa', () => {
  const antivirus = Array.from({ length: 23 }, (_, index) => ({
    id: index + 1, asset_uid: `asset-${index}`, center_code: `TI-${index}`, fecha_vence: '2026-10-01', dias_restantes: 8,
  }));
  const items = licenseNotifications({ antivirus, office365: [], fortigate: [] }, '2026-09-23T12:00:00Z');
  assert.equal(items.filter((item) => item.title.includes('por vencer')).length, 20);
  assert.match(items.at(-1).title, /3 vencimientos adicionales/);
  assert.equal(items.at(-1).href, '/activos/alertas?tipo=antivirus');
});

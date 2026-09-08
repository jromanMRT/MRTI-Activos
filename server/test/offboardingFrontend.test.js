import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);

test('expone la bandeja de bajas, devolución documentada e historial imprimible', async () => {
  const [app, sidebar, layout, page, route] = await Promise.all([
    readFile(new URL('src/App.jsx', root), 'utf8'),
    readFile(new URL('src/components/Sidebar.jsx', root), 'utf8'),
    readFile(new URL('src/components/Layout.jsx', root), 'utf8'),
    readFile(new URL('src/pages/EmployeeOffboardingPage.jsx', root), 'utf8'),
    readFile(new URL('server/src/routes/offboarding.js', root), 'utf8'),
  ]);
  assert.match(app, /path="\/bajas-personal"/);
  assert.match(sidebar, /Bajas de personal/);
  assert.match(layout, /Bajas de personal/);
  assert.match(page, /Baja detectada en RH/);
  assert.match(page, /Confirmar recepción/);
  assert.match(page, /Imprimir constancia/);
  assert.match(page, /Evidencia opcional/);
  assert.match(page, /Revisar accesos y cierre/);
  assert.match(page, /Cuenta de Core/);
  assert.match(page, /Cerrar proceso/);
  assert.match(page, /rhAssetAssignmentProfilesFetch/);
  assert.match(route, /unassigned_at IS NULL/);
  assert.match(route, /asset_offboarding_items/);
  assert.match(route, /syncToSapBestEffort/);
  assert.match(route, /employee_offboarding_cases/);
});

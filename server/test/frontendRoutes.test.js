import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../../', import.meta.url);

test('la interfaz concentra las asignaciones de personas en RH', async () => {
  const [app, sidebar, form, suite, list, api] = await Promise.all([
    readFile(new URL('src/App.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/components/Sidebar.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/AssetFormPage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/AssetSuitePage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/ListPage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/api.js', projectRoot), 'utf8'),
  ]);
  assert.doesNotMatch(sidebar, /Terceros externos|to:\s*['"]\/terceros/);
  assert.doesNotMatch(form, /Asignar a un tercero|Tercero externo \(sin ficha en RH\)/);
  assert.match(form, /\/rh\/empleados\/nuevo/);
  assert.match(app, /path="\/terceros" element={<Navigate replace to="\/"/);
  assert.match(form, /Subir documento/);
  assert.match(form, /PDF, JPG o PNG/);
  assert.match(suite, /Dashboard de activos/);
  assert.match(suite, /Alertas principales/);
  assert.match(suite, /Ocultar claves/);
  assert.match(suite, /aria-sort/);
  assert.match(suite, /SortableTh/);
  assert.match(api, /rhAssetAssignmentProfilesFetch/);
  assert.match(api, /asset-assignment-profiles/);
  assert.match(list, /employeeProfile\?\.employee_number \|\| inheritedEmployeeId/);
});

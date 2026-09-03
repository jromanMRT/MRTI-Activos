import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../../', import.meta.url);

test('la interfaz concentra las asignaciones de personas en RH', async () => {
  const [app, sidebar, form] = await Promise.all([
    readFile(new URL('src/App.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/components/Sidebar.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/AssetFormPage.jsx', projectRoot), 'utf8'),
  ]);
  assert.doesNotMatch(sidebar, /Terceros externos|to:\s*['"]\/terceros/);
  assert.doesNotMatch(form, /Asignar a un tercero|Tercero externo \(sin ficha en RH\)/);
  assert.match(form, /\/rh\/empleados\/nuevo/);
  assert.match(app, /path="\/terceros" element={<Navigate replace to="\/"/);
});

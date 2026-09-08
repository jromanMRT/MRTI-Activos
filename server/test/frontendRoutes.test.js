import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const projectRoot = new URL('../../', import.meta.url);

test('la interfaz concentra las asignaciones de personas en RH', async () => {
  const [app, sidebar, form, suite, list, api, remission] = await Promise.all([
    readFile(new URL('src/App.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/components/Sidebar.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/AssetFormPage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/AssetSuitePage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/pages/ListPage.jsx', projectRoot), 'utf8'),
    readFile(new URL('src/api.js', projectRoot), 'utf8'),
    readFile(new URL('src/remissionPrint.js', projectRoot), 'utf8'),
  ]);
  assert.doesNotMatch(sidebar, /Terceros externos|to:\s*['"]\/terceros/);
  assert.doesNotMatch(form, /Asignar a un tercero|Tercero externo \(sin ficha en RH\)/);
  assert.match(form, /\/rh\/empleados\/nuevo/);
  assert.match(app, /path="\/" element={<AssetSuiteOverviewPage \/>}/);
  assert.match(app, /path="\/inventario" element={<ListPage \/>}/);
  assert.match(app, /path="\/terceros" element={<Navigate replace to="\/inventario"/);
  assert.match(app, /path="\/operacion" element={<Navigate replace to="\/"/);
  assert.match(form, /Subir documento/);
  assert.match(form, /PDF, JPG o PNG/);
  assert.doesNotMatch(form, /<form onSubmit={upload}/);
  assert.match(form, /type="button" onClick={upload}/);
  assert.match(form, /se subió exitosamente/);
  assert.match(form, /onUploaded\(result\.data\)/);
  assert.match(form, /document\.can_delete/);
  assert.match(form, /method: 'DELETE'/);
  assert.match(form, /se eliminó correctamente/);
  assert.match(form, /Eliminar registro/);
  assert.match(form, /No existe un archivo disponible/);
  assert.match(suite, /Dashboard de activos/);
  assert.match(suite, /Alertas principales/);
  assert.match(suite, /Ocultar claves/);
  assert.match(suite, /aria-sort/);
  assert.match(suite, /SortableTh/);
  assert.match(suite, /Filtrar por tipo de alerta/);
  assert.match(suite, /selectedAlert/);
  assert.match(suite, /Activos sin documentos/);
  assert.match(suite, /Selecciona un renglón para completar la información del activo/);
  assert.match(suite, /IncompleteAssetModal/);
  assert.match(suite, /Guardar y finalizar/);
  assert.match(suite, /AssignmentPanel/);
  assert.match(suite, /CATALOG_CREATE_FORMS/);
  assert.match(suite, /\+ Nuevo registro/);
  assert.match(suite, /Crear registro/);
  assert.match(suite, /Creado en MRTI/);
  assert.match(suite, /Adjuntar desde un activo/);
  assert.doesNotMatch(suite, /\['center_code', 'Centro'\]/);
  assert.match(suite, /\['center_code', 'Código TI'\]/);
  assert.match(api, /rhAssetAssignmentProfilesFetch/);
  assert.match(api, /asset-assignment-profiles/);
  const selfRoute = await readFile(new URL('server/src/routes/activosSelf.js', projectRoot), 'utf8');
  assert.match(selfRoute, /mergeEquivalentSelfAssignments/);
  assert.match(list, /employeeProfile\?\.employee_number \|\| inheritedEmployeeId/);
  assert.match(list, /Imprimir remisión de/);
  assert.match(form, /Imprimir remisión/);
  assert.match(form, /Credenciales de remisión/);
  assert.doesNotMatch(form, /key: 'credenciales-remision'/);
  assert.match(form, /Contraseña de Windows local/);
  assert.match(form, /remission-credential-status/);
  assert.match(form, /Guardar credenciales/);
  assert.match(remission, /REMISION DE ENTREGA DE EQUIPO/);
  assert.match(remission, /rhAssetAssignmentProfileFetch/);
  assert.match(remission, /remission-credentials/);
  assert.match(remission, /credentials\.win_password/);
});

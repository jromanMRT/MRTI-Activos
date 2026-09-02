import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAssetSort } from '../src/routes/activos.js';

test('el inventario abre con el código TI más nuevo primero', () => {
  assert.equal(resolveAssetSort(undefined, undefined), "(CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED)) IS NULL ASC, CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED) DESC, (center_code) IS NULL ASC, center_code DESC");
});

test('permite invertir títulos conocidos y rechaza SQL arbitrario', () => {
  assert.equal(resolveAssetSort('brand', 'asc'), "(NULLIF(marca, '')) IS NULL ASC, NULLIF(marca, '') ASC, (NULLIF(modelo, '')) IS NULL ASC, NULLIF(modelo, '') ASC, (NULLIF(descripcion, '')) IS NULL ASC, NULLIF(descripcion, '') ASC, CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED) DESC");
  assert.equal(resolveAssetSort('documents', 'desc'), "(documents_count) IS NULL ASC, documents_count DESC, CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED) DESC");
  assert.equal(resolveAssetSort('center_code; DROP TABLE activos', 'asc'), "(CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED)) IS NULL ASC, CAST(SUBSTRING_INDEX(center_code, '-', -1) AS UNSIGNED) ASC, (center_code) IS NULL ASC, center_code ASC");
});

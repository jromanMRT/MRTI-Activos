import test from 'node:test';
import assert from 'node:assert/strict';
import { readUnitInventory, unitInventoryFilter } from '../src/unitInventory.js';
import { unitCatalogStatus, unitInventoryHref } from '../../src/unitInventory.js';

test('enlaces de unidad conservan nombres y separan ausencia de la etiqueta Sin Asignar', () => {
  for (const name of ['Sin Asignar', 'Villa Matamoros', 'A&B / #1 + Ñ', "O'Hara"]) {
    const url = new URL(unitInventoryHref(name), 'http://localhost');
    const filter = unitInventoryFilter(Object.fromEntries(url.searchParams));
    assert.deepEqual(filter.values, [name]);
    assert.equal(filter.sql, "NULLIF(TRIM(unidad), '') = ?");
  }
  assert.deepEqual(unitInventoryFilter(Object.fromEntries(new URL(unitInventoryHref(null), 'http://localhost').searchParams)),
    { sql: "NULLIF(TRIM(unidad), '') IS NULL", values: [] });
});

test('filtro de unidades parametriza entradas y no altera filtros heredados', () => {
  const attack = "' OR 1=1 --";
  assert.deepEqual(unitInventoryFilter({ unidad_operativa: attack }).values, [attack]);
  for (const query of [{}, { unidad: 'Chihuahua' }, { unidad_operativa: [] }, { unidad_operativa: '   ' }]) {
    assert.equal(unitInventoryFilter(query), null);
  }
});

test('estado del catálogo distingue inactivos, nombres repetidos y valores sin registro', () => {
  assert.equal(unitCatalogStatus({ nombre: null }), 'Sin unidad registrada');
  assert.equal(unitCatalogStatus({ nombre: 'Los Olivos', registros: 0 }), 'Fuera del catálogo');
  assert.equal(unitCatalogStatus({ nombre: 'Sitio', registros: 1, vigentes: 0 }), 'Catálogo inactivo / archivado');
  assert.equal(unitCatalogStatus({ nombre: 'Sitio', registros: 2, vigentes: 1 }), 'Nombre repetido en catálogo');
  assert.equal(unitCatalogStatus({ nombre: 'Dañada', registros: 1, vigentes: 1 }), 'En catálogo');
});

test('conteos SQL se entregan numéricos y los errores se propagan', async () => {
  const rows = await readUnitInventory({ query: async () => [[{ nombre: null, total: '10', asignados: null }]] });
  assert.equal(rows[0].total, 10);
  assert.equal(rows[0].asignados, 0);
  await assert.rejects(readUnitInventory({ query: async () => { throw new Error('DB unavailable'); } }), /DB unavailable/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { unitReviewQueue, unitReviewReasons, REVIEW_REASON_LABELS } from '../src/unitReviewQueue.js';

function baseGroup(overrides = {}) {
  return { nombre: 'TI', registros: 1, vigentes: 1, orden: 1, total: 5, activos: 5, mantenimiento: 0, bajas: 0, asignados: 0, ...overrides };
}

test('un equipo sin unidad siempre necesita revisión', () => {
  assert.deepEqual(unitReviewReasons(baseGroup({ nombre: null, registros: 0, vigentes: 0, total: 10 }), []), ['sin_unidad']);
});

test('un nombre fuera del catálogo se marca aunque tenga equipos activos', () => {
  assert.deepEqual(unitReviewReasons(baseGroup({ registros: 0, vigentes: 0 }), []), ['fuera_de_catalogo']);
});

test('un catálogo inactivo se distingue de estar totalmente fuera de catálogo', () => {
  assert.deepEqual(unitReviewReasons(baseGroup({ registros: 1, vigentes: 0 }), [{ usage_kind: 'pending' }]), ['catalogo_inactivo', 'sin_clasificar']);
});

test('un nombre repetido en el catálogo se marca sin importar su clasificación', () => {
  const catalog = [{ usage_kind: 'physical', reference_id: 'a1' }, { usage_kind: 'physical', reference_id: 'a1' }];
  assert.deepEqual(unitReviewReasons(baseGroup({ registros: 2, vigentes: 2 }), catalog), ['nombre_repetido']);
});

test('una unidad recién sincronizada de SAP aparece como pendiente de clasificar', () => {
  assert.deepEqual(unitReviewReasons(baseGroup(), [{ usage_kind: 'pending' }]), ['sin_clasificar']);
});

test('una etiqueta histórica ya clasificada no aparece si nadie la usa', () => {
  assert.deepEqual(unitReviewReasons(baseGroup({ total: 0, activos: 0 }), [{ usage_kind: 'legacy' }]), []);
});

test('una etiqueta legacy sigue en revisión si todavía hay equipos con ese nombre', () => {
  assert.deepEqual(unitReviewReasons(baseGroup({ total: 3 }), [{ usage_kind: 'legacy' }]), ['etiqueta_historica_en_uso']);
});

test('una clasificación ligada sin referencia vigente se marca pendiente', () => {
  assert.deepEqual(unitReviewReasons(baseGroup(), [{ usage_kind: 'organizational', reference_id: null }]), ['referencia_pendiente']);
});

test('una unidad ya clasificada con referencia y sin duplicados no aparece en la bandeja', () => {
  assert.deepEqual(unitReviewReasons(baseGroup(), [{ usage_kind: 'organizational', reference_id: '12' }]), []);
});

test('todas las etiquetas de motivo tienen una descripción legible', () => {
  for (const reason of ['sin_unidad', 'fuera_de_catalogo', 'catalogo_inactivo', 'nombre_repetido', 'sin_clasificar', 'etiqueta_historica_en_uso', 'referencia_pendiente']) {
    assert.equal(typeof REVIEW_REASON_LABELS[reason], 'string');
  }
});

test('unitReviewQueue combina el inventario con el catálogo por nombre y filtra lo que ya está resuelto', async () => {
  const db = {
    calls: [],
    async query(sql) {
      db.calls.push(sql);
      if (/reviewed_by/.test(sql)) {
        return [[
          { id: 2, nombre: 'Contabilidad', usage_kind: 'organizational', reference_id: '9' },
        ]];
      }
      // Simula readUnitInventory: una fila sin unidad, una fuera de catálogo, una resuelta.
      return [[
        { nombre: null, registros: 0, vigentes: 0, orden: null, total: 10, activos: 10, mantenimiento: 0, bajas: 0, asignados: 0 },
        { nombre: 'El Realito', registros: 0, vigentes: 0, orden: null, total: 1, activos: 1, mantenimiento: 0, bajas: 0, asignados: 0 },
        { nombre: 'Contabilidad', registros: 1, vigentes: 1, orden: 1, total: 4, activos: 4, mantenimiento: 0, bajas: 0, asignados: 2 },
      ]];
    },
  };
  const queue = await unitReviewQueue(db);
  assert.deepEqual(queue.map((row) => row.nombre), [null, 'El Realito']);
  assert.deepEqual(queue.find((row) => row.nombre === 'El Realito').catalog, []);
  assert.deepEqual(queue.find((row) => row.nombre === null).reasons, ['sin_unidad']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIT_KINDS, captureUnit, classifyUnit, normalizeUnitName, normalizeUnitReview,
  recordUnitChange, reviewReason, revertUnitChange, revisionNumber, saveAssetFields,
  unitSnapshot, unitSnapshotsEqual, unitUsage,
} from '../src/domain/unitReview.js';

test('reviewReason exige motivo con evidencia real, no una palabra suelta', () => {
  assert.throws(() => reviewReason(''), /motivo y la evidencia/);
  assert.throws(() => reviewReason('corto'), /motivo y la evidencia/);
  assert.throws(() => reviewReason('x'.repeat(1001)), /motivo y la evidencia/);
  assert.equal(reviewReason('  Confirmado con el responsable del sitio.  '), 'Confirmado con el responsable del sitio.');
});

test('revisionNumber sólo acepta enteros no negativos -- protege la concurrencia', () => {
  assert.throws(() => revisionNumber(-1), /revisión del registro/);
  assert.throws(() => revisionNumber('3'), /revisión del registro/);
  assert.throws(() => revisionNumber(1.5), /revisión del registro/);
  assert.equal(revisionNumber(0), 0);
});

test('normalizeUnitName distingue vaciar de no tocar y limita la longitud', () => {
  assert.equal(normalizeUnitName(''), null);
  assert.equal(normalizeUnitName(null), null);
  assert.equal(normalizeUnitName('  Villa Matamoros  '), 'Villa Matamoros');
  assert.throws(() => normalizeUnitName('x'.repeat(61)), /60 caracteres/);
  assert.throws(() => normalizeUnitName(42), /60 caracteres/);
});

test('normalizeUnitReview exige referencia sólo para clasificaciones ligadas y valida el catálogo', () => {
  assert.throws(() => normalizeUnitReview({ usage_kind: 'no-existe' }), /Clasificación de unidad inválida/);
  assert.throws(() => normalizeUnitReview({ usage_kind: 'physical', review_note: 'Confirmado en sitio con evidencia' }), /referencia vigente/);
  assert.deepEqual(
    normalizeUnitReview({ usage_kind: 'legacy', review_note: 'Etiqueta histórica confirmada', revision: 0 }),
    { usage_kind: 'legacy', reference_id: null, review_note: 'Etiqueta histórica confirmada', revision: 0 }
  );
  const linked = normalizeUnitReview({ usage_kind: 'physical', reference_id: ' area-1 ', review_note: 'Confirmado con Monitor', revision: 2 });
  assert.deepEqual(linked, { usage_kind: 'physical', reference_id: 'area-1', review_note: 'Confirmado con Monitor', revision: 2 });
  assert.ok(UNIT_KINDS.includes('pending'));
});

test('unitSnapshot sólo captura los tres campos que gobierna esta unidad', () => {
  assert.deepEqual(unitSnapshot({ unidad: 'TI', unit_is_manual: '1', physical_area_id: 'area-1', otro: 'ignorado' }),
    { unidad: 'TI', unit_is_manual: 1, physical_area_id: 'area-1' });
  assert.deepEqual(unitSnapshot({}), { unidad: null, unit_is_manual: 0, physical_area_id: null });
});

test('unitSnapshotsEqual compara campo por campo, no por orden de claves JSON', () => {
  const a = { physical_area_id: 'a1', unidad: 'TI', unit_is_manual: 1 };
  const b = { unidad: 'TI', unit_is_manual: '1', physical_area_id: 'a1' };
  assert.equal(unitSnapshotsEqual(a, b), true);
  assert.equal(unitSnapshotsEqual(a, { ...b, unidad: 'Otra' }), false);
});

function mockPool(queryImpl) {
  return { query: queryImpl };
}

test('captureUnit exige una unidad vigente y única del catálogo, salvo que no cambie', async () => {
  let calls = 0;
  const db = mockPool(async () => { calls += 1; return [[]]; });
  await assert.rejects(captureUnit(db, 'Nombre Nuevo'), /única del catálogo/);
  assert.equal(calls, 1);

  calls = 0;
  const dbSame = mockPool(async () => { calls += 1; return [[]]; });
  assert.equal(await captureUnit(dbSame, 'TI', 'TI'), 'TI');
  assert.equal(calls, 0, 'no consulta el catálogo si el valor no cambia');

  const dbFound = mockPool(async () => [[{ nombre: ' TI ' }]]);
  assert.equal(await captureUnit(dbFound, 'TI'), 'TI');

  assert.equal(await captureUnit(mockPool(async () => [[]]), ''), null);
  assert.equal(await captureUnit(mockPool(async () => [[]]), null, 'TI'), null);
});

function mockConnection({ asset, rows = [] }) {
  const queries = [];
  const state = { asset: { ...asset } };
  return {
    queries,
    connection: {
      async beginTransaction() { queries.push('BEGIN'); },
      async commit() { queries.push('COMMIT'); },
      async rollback() { queries.push('ROLLBACK'); },
      release() { queries.push('RELEASE'); },
      async query(sql, params) {
        queries.push([sql.trim().slice(0, 40), params]);
        if (/SELECT \* FROM activos WHERE id = \? FOR UPDATE/.test(sql)) return [[state.asset]];
        if (/SELECT nombre FROM sap_unidades/.test(sql)) return [rows];
        if (/INSERT INTO asset_unit_changes/.test(sql)) return [{ affectedRows: 1 }];
        if (/INSERT INTO audit_events/.test(sql)) return [{ affectedRows: 1 }];
        if (/UPDATE activos SET/.test(sql)) return [{ affectedRows: 1 }];
        return [[]];
      },
    },
  };
}

test('saveAssetFields sólo audita y protege la unidad cuando realmente cambia', async () => {
  const asset = { id: 7, asset_uid: 'uid-7', unidad: 'TI', unit_is_manual: 0, unit_revision: 0, physical_area_id: null };
  const { connection, queries } = mockConnection({ asset, rows: [{ nombre: 'Contabilidad' }] });
  const db = { async getConnection() { return connection; } };
  const actor = { id: 'user-1', name: 'Ana' };

  const result = await saveAssetFields(db, 7, { unidad: 'Contabilidad', marca: 'Dell' }, actor, { reason: 'Corrección confirmada con el área receptora.' });
  assert.equal(result.changed, true);
  assert.equal(result.data.unidad, 'Contabilidad');
  assert.equal(result.data.unit_is_manual, 1);
  assert.equal(result.data.unit_revision, 1);
  assert.ok(queries.some((q) => Array.isArray(q) && /INSERT INTO asset_unit_changes/.test(q[0])));
});

test('saveAssetFields no toca el historial cuando la unidad no cambia', async () => {
  const asset = { id: 7, asset_uid: 'uid-7', unidad: 'TI', unit_is_manual: 0, unit_revision: 0, physical_area_id: null };
  const { connection, queries } = mockConnection({ asset });
  const db = { async getConnection() { return connection; } };
  const result = await saveAssetFields(db, 7, { unidad: 'TI', marca: 'HP' }, { id: 'user-1' });
  assert.equal(result.changed, false);
  assert.equal(queries.some((q) => Array.isArray(q) && /INSERT INTO asset_unit_changes/.test(q[0])), false);
});

test('saveAssetFields rechaza una corrección concurrente con la revisión esperada', async () => {
  const asset = { id: 7, asset_uid: 'uid-7', unidad: 'TI', unit_is_manual: 0, unit_revision: 3, physical_area_id: null };
  const { connection } = mockConnection({ asset, rows: [{ nombre: 'Contabilidad' }] });
  const db = { async getConnection() { return connection; } };
  await assert.rejects(
    saveAssetFields(db, 7, { unidad: 'Contabilidad' }, { id: 'user-1' }, { expectedRevision: 0 }),
    /cambió mientras la revisabas/
  );
});

test('recordUnitChange exige un autor identificado', async () => {
  await assert.rejects(
    recordUnitChange({ query: async () => [{}] }, { asset_uid: 'x', unit_revision: 0 }, {}, {}, 'motivo con evidencia suficiente'),
    /identificar al autor/
  );
});

// audit_events.request_id es CHAR(36) NOT NULL sin default (migración 004):
// cualquier INSERT que la omita falla en producción, no en una prueba
// aislada -- por eso se verifica aquí columna por columna contra los
// placeholders reales del VALUES, no sólo que la palabra aparezca en el SQL.
function placeholderValueFor(sql, params, columnName) {
  const columns = sql.match(/\(([^)]+)\)/)[1].split(',').map((c) => c.trim());
  const valuesClause = sql.match(/VALUES\s*\(([^]+)\)\s*$/)[1];
  const tokens = valuesClause.split(',').map((t) => t.trim());
  assert.equal(columns.length, tokens.length, 'columnas y tokens de VALUES deben coincidir 1 a 1');
  let placeholderIndex = -1;
  for (let i = 0; i < columns.length; i += 1) {
    if (tokens[i] === '?') {
      placeholderIndex += 1;
      if (columns[i] === columnName) return params[placeholderIndex];
    } else if (columns[i] === columnName) {
      return tokens[i]; // valor literal, no placeholder
    }
  }
  throw new Error(`columna ${columnName} no encontrada`);
}

test('recordUnitChange manda request_id en el audit_events (columna NOT NULL sin default)', async () => {
  const inserts = [];
  const connection = { query: async (sql, params) => { inserts.push({ sql, params }); return [{ affectedRows: 1 }]; } };
  await recordUnitChange(connection, { asset_uid: 'uid-1', unit_revision: 0 }, { unidad: 'X' }, { id: 'user-1', name: 'Ana' }, 'motivo con evidencia suficiente');
  const auditInsert = inserts.find((call) => /INSERT INTO audit_events/.test(call.sql));
  assert.ok(auditInsert, 'debe insertar en audit_events');
  assert.match(String(placeholderValueFor(auditInsert.sql, auditInsert.params, 'request_id')), /^[0-9a-f-]{36}$/);
});

test('unitUsage cuenta activos y componentes que usan el mismo nombre, incluyendo null', async () => {
  const db = mockPool(async (sql) => {
    if (/FROM activos/.test(sql)) return [[{ total: 3 }]];
    return [[{ total: 1 }]];
  });
  assert.deepEqual(await unitUsage(db, 'TI'), { assets: 3, components: 1 });
});

test('classifyUnit exige identificar al autor antes de validar nada más', async () => {
  await assert.rejects(classifyUnit({}, 1, { usage_kind: 'legacy', review_note: 'Etiqueta histórica confirmada', revision: 0 }, {}), /identificar al autor/);
});

test('classifyUnit rechaza una referencia física que Monitor no confirma vigente', async () => {
  // obsClient.js llama a fetch() global directamente -- se reemplaza aquí
  // para no depender de que MRTI-Obs esté arriba durante las pruebas.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  try {
    await assert.rejects(
      classifyUnit({}, 1, { usage_kind: 'physical', reference_id: 'area-x', review_note: 'Confirmado con el sitio', revision: 0 }, { id: 'admin-1' }),
      /MRTI-Obs no la confirma vigente/
    );
  } finally { globalThis.fetch = originalFetch; }
});

test('classifyUnit acepta una referencia física vigente y clasifica con concurrencia', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { id: 'area-1', name: 'Sitio Norte' } }) });
  const queries = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params) {
      queries.push([sql.trim().slice(0, 40), params]);
      if (/SELECT id, nombre, usage_kind/.test(sql)) return [[{ id: 1, nombre: 'El Realito', usage_kind: 'pending', reference_id: null, review_revision: 0 }]];
      return [{ affectedRows: 1 }];
    },
  };
  const db = { async getConnection() { return connection; } };
  try {
    const result = await classifyUnit(db, 1, { usage_kind: 'physical', reference_id: 'area-1', review_note: 'Confirmado con el responsable del sitio.', revision: 0 }, { id: 'admin-1', name: 'Ana', authorization: 'Bearer t' });
    assert.deepEqual(result, { id: 1, nombre: 'El Realito', usage_kind: 'physical', reference_id: 'area-1', revision: 1 });
    assert.ok(queries.some((q) => /UPDATE sap_unidades SET usage_kind/.test(q[0])));
  } finally { globalThis.fetch = originalFetch; }
});

test('classifyUnit también manda request_id en su propio audit_events', async () => {
  const inserts = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(sql, params) {
      inserts.push({ sql, params });
      if (/SELECT id, nombre, usage_kind/.test(sql)) return [[{ id: 1, nombre: 'El Realito', usage_kind: 'pending', reference_id: null, review_revision: 0 }]];
      return [{ affectedRows: 1 }];
    },
  };
  const db = { async getConnection() { return connection; } };
  await classifyUnit(db, 1, { usage_kind: 'legacy', review_note: 'Etiqueta histórica confirmada por el área.', revision: 0 }, { id: 'admin-1' });
  const auditInsert = inserts.find((call) => /INSERT INTO audit_events/.test(call.sql));
  assert.match(String(placeholderValueFor(auditInsert.sql, auditInsert.params, 'request_id')), /^[0-9a-f-]{36}$/);
});

test('classifyUnit rechaza una clasificación cuya revisión ya cambió', async () => {
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql) {
      if (/SELECT id, nombre, usage_kind/.test(sql)) return [[{ id: 1, nombre: 'El Realito', usage_kind: 'pending', reference_id: null, review_revision: 5 }]];
      return [{ affectedRows: 1 }];
    },
  };
  const db = { async getConnection() { return connection; } };
  await assert.rejects(
    classifyUnit(db, 1, { usage_kind: 'legacy', review_note: 'Etiqueta histórica confirmada por el área.', revision: 0 }, { id: 'admin-1' }),
    /cambió mientras la revisabas/
  );
});

test('revertUnitChange rechaza revertir sobre un activo con cambios posteriores', async () => {
  const event = {
    id: 'change-1', asset_uid: 'uid-7', asset_revision: 1,
    before_json: JSON.stringify({ unidad: 'TI', unit_is_manual: 0, physical_area_id: null }),
    after_json: JSON.stringify({ unidad: 'Contabilidad', unit_is_manual: 1, physical_area_id: null }),
  };
  const asset = { id: 7, asset_uid: 'uid-7', unidad: 'Otra unidad más', unit_is_manual: 1, unit_revision: 1, physical_area_id: null };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql) {
      if (/FROM asset_unit_changes WHERE id/.test(sql)) return [[event]];
      if (/FROM activos WHERE asset_uid/.test(sql)) return [[asset]];
      return [[]];
    },
  };
  const db = { async getConnection() { return connection; } };
  await assert.rejects(
    revertUnitChange(db, 'change-1', { id: 'admin-1' }, 'Se revierte porque el área confirmó el error de captura.'),
    /cambios posteriores/
  );
});

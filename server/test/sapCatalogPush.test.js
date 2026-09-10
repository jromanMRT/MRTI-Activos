import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDominiosWritableFields, pickUnidadesWritableFields,
  pickImpresorasWritableFields, pickStarlinkWritableFields,
} from '../src/integrations/sapClient.js';

const BOOKKEEPING = {
  id: 12, sap_id: 4, record_origin: 'local', synced_at: '2026-01-01', archived_at: null,
  locally_edited_at: '2026-01-01', locally_edited_by: 'uuid-user', sap_synced_at: null, sap_sync_error: null,
};

test('dominios sólo envía los 5 campos que existen en dbo.Dominios', () => {
  assert.deepEqual(pickDominiosWritableFields({
    dominio: 'minerariotinto.mx', servicios: 'DNS, correo', fecha_expira: '2027-01-01',
    status: 'activo', comentario: 'Renovado', ...BOOKKEEPING,
  }), {
    dominio: 'minerariotinto.mx', servicios: 'DNS, correo', fecha_expira: '2027-01-01',
    status: 'activo', comentario: 'Renovado',
  });
});

test('unidades sólo envía nombre/activa/orden (nunca las columnas de revisión de unidad, que son locales)', () => {
  assert.deepEqual(pickUnidadesWritableFields({
    nombre: 'TI', activa: 1, orden: 3, usage_kind: 'asset', reference_id: 'x',
    review_note: 'nota', reviewed_by: 'uuid', reviewed_at: '2026-01-01', review_revision: 2, ...BOOKKEEPING,
  }), { nombre: 'TI', activa: 1, orden: 3 });
});

test('impresoras sí incluye ip_address/mac_address/hostname (a diferencia de fortigate, dbo.Impresoras sí tiene esas columnas)', () => {
  assert.deepEqual(pickImpresorasWritableFields({
    usuario: 'ana', ubicacion: 'Matriz', ip_address: '10.0.0.5', mac_address: 'AA:BB',
    hostname: 'PRN-01', modelo: 'LaserJet', numero_serie: 'SN-1', conteo_paginas: 100,
    comentario: 'ok', ...BOOKKEEPING,
  }), {
    usuario: 'ana', ubicacion: 'Matriz', ip_address: '10.0.0.5', mac_address: 'AA:BB',
    hostname: 'PRN-01', modelo: 'LaserJet', numero_serie: 'SN-1', conteo_paginas: 100, comentario: 'ok',
  });
});

test('starlink sólo envía los 9 campos que existen en dbo.Starlink', () => {
  assert.deepEqual(pickStarlinkWritableFields({
    correo_cuenta: 'a@b.com', ubicacion: 'Sitio 1', id_starlink: 'ST-1', version_equipo: 'v3',
    importe_mes: 1500, dia_corte: '5', suscripcion: 'Business', cliente: 'MRT', comentario: 'ok', ...BOOKKEEPING,
  }), {
    correo_cuenta: 'a@b.com', ubicacion: 'Sitio 1', id_starlink: 'ST-1', version_equipo: 'v3',
    importe_mes: 1500, dia_corte: '5', suscripcion: 'Business', cliente: 'MRT', comentario: 'ok',
  });
});

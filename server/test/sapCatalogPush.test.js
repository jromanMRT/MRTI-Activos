import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDominiosWritableFields, pickUnidadesWritableFields,
  pickImpresorasWritableFields, pickStarlinkWritableFields,
  pickComponentesWritableFields, pickMantenimientosWritableFields,
  pickNvrWritableFields, pickPasswordsWritableFields, pickConfigAlertasWritableFields,
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

test('componentes nunca envía center_code como columna directa (se resuelve aparte a activo_id)', () => {
  const picked = pickComponentesWritableFields({
    center_code: 'TI-00001', code: 'C-1', nombre: 'RAM', tipo: 'Memoria', marca: 'Kingston',
    modelo: '8GB', serial_service_tag: 'SN-1', firmware: '1.0', ip_address: '10.0.0.1',
    mac_address: 'AA:BB', hostname: 'PC-1', unidad: 'TI', departamento: 'Sistemas', usuario: 'ana',
    contabilidad: 'X', orden_compra: 'OC-1', comentario: 'ok', ...BOOKKEEPING,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'center_code'), false);
  assert.deepEqual(picked, {
    code: 'C-1', nombre: 'RAM', tipo: 'Memoria', marca: 'Kingston', modelo: '8GB',
    serial_service_tag: 'SN-1', firmware: '1.0', ip_address: '10.0.0.1', mac_address: 'AA:BB',
    hostname: 'PC-1', unidad: 'TI', departamento: 'Sistemas', usuario: 'ana',
    contabilidad: 'X', orden_compra: 'OC-1', comentario: 'ok',
  });
});

test('mantenimientos nunca envía center_code como columna directa (se resuelve aparte a activo_id)', () => {
  const picked = pickMantenimientosWritableFields({
    center_code: 'TI-00001', fecha_servicio: '2026-01-01', fecha_fin: '2026-01-02',
    tipo_servicio: 'Preventivo', descripcion: 'Limpieza', tecnico: 'Juan', proveedor: 'ACME',
    costo: 500, numero_ticket: 'T-1', estado: 'Completado', garantia_hasta: '2027-01-01',
    observaciones: 'ok', creado_por: 'ana', ...BOOKKEEPING,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'center_code'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'creado_por'), false);
  assert.deepEqual(picked, {
    fecha_servicio: '2026-01-01', fecha_fin: '2026-01-02', tipo_servicio: 'Preventivo',
    descripcion: 'Limpieza', tecnico: 'Juan', proveedor: 'ACME', costo: 500, numero_ticket: 'T-1',
    estado: 'Completado', garantia_hasta: '2027-01-01', observaciones: 'ok',
  });
});

test('nvr NUNCA incluye password_encrypted/clave_cifrado_encrypted/codigo_verificacion_encrypted, aunque vengan en el objeto', () => {
  const picked = pickNvrWritableFields({
    alias: 'Cámara entrada', device_domain: 'dvr.local', device_serial: 'SN-1', ip_port: '10.0.0.1:554',
    status: 'activo', usuario: 'admin', acceso_local: 'si', localidad: 'Matriz', ubicacion: 'Entrada',
    password_encrypted: 'CIFRADO-NO-DEBE-SALIR', clave_cifrado_encrypted: 'CIFRADO-NO-DEBE-SALIR',
    codigo_verificacion_encrypted: 'CIFRADO-NO-DEBE-SALIR', ...BOOKKEEPING,
  });
  assert.deepEqual(picked, {
    alias: 'Cámara entrada', device_domain: 'dvr.local', device_serial: 'SN-1', ip_port: '10.0.0.1:554',
    status: 'activo', usuario: 'admin', acceso_local: 'si', localidad: 'Matriz', ubicacion: 'Entrada',
  });
  for (const secretColumn of ['password_encrypted', 'clave_cifrado_encrypted', 'codigo_verificacion_encrypted']) {
    assert.equal(Object.prototype.hasOwnProperty.call(picked, secretColumn), false);
  }
});

test('passwords NUNCA incluye password_encrypted, aunque venga en el objeto', () => {
  const picked = pickPasswordsWritableFields({
    categoria: 'Red', subcategoria: 'Router', ip: '10.0.0.1', direccion: 'Matriz',
    usuario: 'admin', comentario: 'ok', password_encrypted: 'CIFRADO-NO-DEBE-SALIR', ...BOOKKEEPING,
  });
  assert.deepEqual(picked, {
    categoria: 'Red', subcategoria: 'Router', ip: '10.0.0.1', direccion: 'Matriz', usuario: 'admin', comentario: 'ok',
  });
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'password_encrypted'), false);
});

test('config-alertas sólo envía nombre/dias_aviso/activo (nunca la llave clave como columna, ni las marcas locales)', () => {
  const picked = pickConfigAlertasWritableFields({
    clave: 'antivirus', nombre: 'Antivirus', dias_aviso: 45, activo: 1, ...BOOKKEEPING,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(picked, 'clave'), false);
  assert.deepEqual(picked, { nombre: 'Antivirus', dias_aviso: 45, activo: 1 });
});

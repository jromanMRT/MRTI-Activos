import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRemissionHtml, escapeRemissionHtml } from '../../src/remissionPrint.js';

test('la remisión escapa datos dinámicos e imprime las credenciales autorizadas', () => {
  const html = buildRemissionHtml({
    asset: {
      center_code: '<script>alert(1)</script>',
      empresa: 'Empresa & Asociados',
      usuario_asignado: 'Nombre antiguo',
      id_empleado: '001',
      win_usuario: 'usuario.local',
      win_password: 'SECRETO-WINDOWS',
      ms_password: 'SECRETO-MICROSOFT',
      db_password: 'SECRETO-DROPBOX',
    },
    employeeProfile: {
      employee_number: '1978',
      full_name: 'Nombre vigente',
      company_name: 'Empresa RH',
      unit_name: 'Unidad Norte',
      area_name: 'Operaciones',
      job_title: 'Supervisión',
      phone: '6140000000',
    },
    credentials: {
      win_password: '<clave-windows>',
      ms_password: 'CLAVE-MICROSOFT',
      password_mrt: 'CLAVE-MRT',
      password_corporativo: 'CLAVE-CORPORATIVA',
      db_password: 'CLAVE-DROPBOX',
    },
    actorName: 'Administrador',
    generatedAt: new Date('2026-09-04T18:00:00Z'),
  });

  assert.equal(escapeRemissionHtml('<b>uno & dos</b>'), '&lt;b&gt;uno &amp; dos&lt;/b&gt;');
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Empresa &amp; Asociados/);
  assert.match(html, /Nombre vigente/);
  assert.match(html, /1978/);
  assert.match(html, /Unidad Norte/);
  assert.doesNotMatch(html, /Nombre antiguo/);
  assert.doesNotMatch(html, /SECRETO-WINDOWS|SECRETO-MICROSOFT|SECRETO-DROPBOX/);
  assert.match(html, /&lt;clave-windows&gt;/);
  assert.match(html, /CLAVE-MICROSOFT/);
  assert.match(html, /CLAVE-MRT/);
  assert.match(html, /CLAVE-CORPORATIVA/);
  assert.match(html, /CLAVE-DROPBOX/);
  assert.match(html, /Password/);
  assert.match(html, /size:215\.9mm 279\.4mm/);
});

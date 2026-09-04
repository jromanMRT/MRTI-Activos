import { apiFetch, rhAssetAssignmentProfileFetch } from './api.js';

const EMPTY_VALUE = '—';

export function escapeRemissionHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function value(valueToRender, fallback = EMPTY_VALUE) {
  const normalized = String(valueToRender ?? '').trim();
  return escapeRemissionHtml(normalized || fallback);
}

function currentActorName() {
  try {
    return JSON.parse(localStorage.getItem('auth_profile') || '{}').full_name || 'MRTI Activos';
  } catch {
    return 'MRTI Activos';
  }
}

function calendarDate(date) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(date);
}

export function buildRemissionHtml({ asset, employeeProfile = null, actorName = 'MRTI Activos', generatedAt = new Date() }) {
  const employeeNumber = employeeProfile?.employee_number || asset.id_empleado;
  const employeeName = employeeProfile?.full_name || asset.usuario_asignado;
  const phone = employeeProfile?.phone || asset.cel_empleado;
  const company = asset.empresa || employeeProfile?.company_name || 'Minera Río Tinto';
  const unit = employeeProfile?.unit_name || asset.unidad;
  const jobTitle = employeeProfile?.job_title || asset.correo_puesto;
  const responsibleSignature = [employeeNumber, employeeName].filter(Boolean).join(' · ');
  const generatedDate = calendarDate(generatedAt);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remisión ${value(asset.center_code, '')}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 7pt; }
    .page { width: 216mm; min-height: 279mm; margin: 0 auto; padding: 12mm 9mm 8mm; }
    .header { display: flex; min-height: 26mm; justify-content: space-between; gap: 10mm; align-items: flex-start; border-bottom: 1px solid #000; padding-bottom: 2px; }
    .company { font-size: 10pt; font-weight: 700; }
    .title { margin-top: 1px; font-size: 8.5pt; font-weight: 700; }
    .document-meta { flex: 0 0 58mm; text-align: right; font-size: 6.2pt; line-height: 1.15; }
    .document-number { margin-bottom: 1px; font-size: 7.2pt; font-weight: 700; }
    .section-title { margin-top: 3px; border: 1px solid #000; padding: 2px 3px; background: #3f3f3f; color: #fff; font-size: 6.7pt; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { height: 4.3mm; border: 1px solid #000; padding: 1px 3px; overflow-wrap: anywhere; vertical-align: middle; line-height: 1.05; }
    th { background: #d9d9d9; text-align: left; font-weight: 700; }
    .access-head th { background: #cfcfcf; }
    .conditions { margin-top: 3px; border: 1px solid #000; padding: 3px; font-size: 5.8pt; line-height: 1.08; }
    .conditions p { margin: 0 0 1px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 17mm; }
    .signature { min-height: 17mm; border-top: 1px solid #000; padding-top: 9mm; text-align: center; font-size: 6pt; line-height: 1.2; }
    .signature strong { display: block; }
    .footer { margin-top: -5mm; text-align: right; font-size: 5.5pt; }
    @page { size: letter portrait; margin: 0; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div><div class="company">${value(company)}</div><div class="title">REMISIÓN DE ENTREGA DE EQUIPO</div></div>
      <div class="document-meta">
        <div class="document-number">No. Remisión: ${value(asset.center_code)} Rev 0</div>
        <div>Fecha: ${value(generatedDate)}</div>
        <div>Página 1</div>
        <div>Autor: ${value(actorName)}</div>
        <div>Remisión V 2.0-2023</div>
      </div>
    </header>

    <div class="section-title">Descripción del equipo</div>
    <table>
      <colgroup><col style="width:15%"><col style="width:35%"><col style="width:13%"><col style="width:17%"><col style="width:8%"><col style="width:12%"></colgroup>
      <tr><th>Marca/Modelo</th><td>${value(asset.marca)}<br>${value(asset.modelo)}</td><th>Service TAG</th><td>${value(asset.service_tag)}</td><th>PIN</th><td>${value(asset.service_tag)}</td></tr>
      <tr><th>Tipo</th><td>${value(asset.tipo)}</td><th>Serie</th><td>${value(asset.numero_serie)}</td><th>Activo<br>Fijo</th><td>${value(asset.cod_activo_fijo)}</td></tr>
      <tr><th>Descripción</th><td colspan="5">${value(asset.descripcion || asset.esp_tec)}</td></tr>
    </table>

    <div class="section-title">Datos del empleado / asignación</div>
    <table>
      <colgroup><col style="width:15%"><col style="width:14%"><col style="width:14%"><col style="width:27%"><col style="width:10%"><col style="width:20%"></colgroup>
      <tr><th>No. Empleado</th><td>${value(employeeNumber)}</td><th>Empleado</th><td>${value(employeeName)}</td><th>Cel.</th><td>${value(phone)}</td></tr>
      <tr><th>Puesto</th><td>${value(jobTitle)}</td><th>Unidad Destino</th><td>${value(unit)}</td><th>Contabilidad</th><td>${value(asset.cuenta_contable)}</td></tr>
    </table>

    <div class="section-title">Características de acceso / credenciales</div>
    <table>
      <colgroup><col style="width:30%"><col style="width:35%"><col style="width:35%"></colgroup>
      <tr class="access-head"><th>Cuenta</th><th>Usuario</th><th>Contraseña</th></tr>
      <tr><td>Usuario Windows Local</td><td>${value(asset.win_usuario || asset.win_cuenta)}</td><td>No se imprime</td></tr>
      <tr><td>Cuenta Microsoft / Office</td><td>${value(asset.ms_usuario || asset.ms_cuenta || asset.correo_corporativo, 'Sin cuenta')}</td><td>No se imprime</td></tr>
      <tr><td>Correo Autorizado (MRT)</td><td>${value(asset.correo_mrt)}</td><td>No se imprime</td></tr>
      <tr><td>Correo Corporativo</td><td>${value(asset.correo_corporativo)}</td><td>No se imprime</td></tr>
      <tr><td>Dropbox</td><td>${value(asset.db_usuario || asset.db_cuenta, 'Sin cuenta')}</td><td>No se imprime</td></tr>
    </table>

    <div class="section-title">Software incluido / licencias</div>
    <table>
      <colgroup><col style="width:30%"><col style="width:70%"></colgroup>
      <tr class="access-head"><th>Concepto</th><th>Detalle</th></tr>
      <tr><td>Software incluido</td><td>${value(asset.software_incluido)}</td></tr>
      <tr><td>Microsoft / Office 365</td><td>${value(asset.ms_suscripcion || asset.ms_licencia)}</td></tr>
      <tr><td>Dropbox</td><td>${value(asset.db_licencia)}</td></tr>
      <tr><td>Antivirus</td><td>${value(asset.av_comentario || asset.av_team || asset.av_licencia)}</td></tr>
    </table>

    <section class="conditions">
      <p><strong>CONDICIONES DE USO Y RESGUARDO:</strong></p>
      <p>1. El equipo debe permanecer en buenas condiciones de uso.</p>
      <p>2. Las fallas de software o hardware debidas al uso normal deberán reportarse al área de TI para su diagnóstico y reparación.</p>
      <p>3. La persona responsable deberá cubrir la reposición del equipo extraviado o dañado por uso inadecuado, conforme a las políticas aplicables.</p>
      <p>4. El equipo podrá ser auditado en software y hardware en cualquier momento.</p>
      <p>5. El equipo deberá entregarse al departamento correspondiente cuando termine la necesidad de uso.</p>
      <p>6. El equipo se entrega configurado con el software autorizado por la empresa. La instalación o uso de software no autorizado es responsabilidad del usuario.</p>
      <p>7. Queda prohibida la instalación de software no autorizado por TI.</p>
    </section>

    <section class="signatures">
      <div class="signature"><strong>${value(responsibleSignature, '')}</strong>Responsable del equipo</div>
      <div class="signature"><strong>Nombre, firma y fecha</strong>Envío RH · Recepción de equipo</div>
      <div class="signature"><strong>Nombre, firma y fecha</strong>Autorización TI</div>
    </section>
    <footer class="footer">${value(asset.center_code)} · ${value(asset.service_tag, '')} · Generado el ${value(generatedDate)}</footer>
  </main>
</body>
</html>`;
}

function loadingHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Preparando remisión</title></head><body style="font:16px Arial;padding:32px">Preparando remisión…</body></html>';
}

export async function openAssetRemission({ assetId, employeeProfile = null }) {
  const printWindow = window.open('', '_blank', 'width=960,height=760');
  if (!printWindow) throw new Error('Permite las ventanas emergentes para imprimir la remisión.');
  printWindow.document.write(loadingHtml());
  printWindow.document.close();

  try {
    const response = await apiFetch(`/activos/${assetId}`);
    const asset = response.data;
    let resolvedEmployee = employeeProfile;
    if (!resolvedEmployee && (asset.rh_employee_id || asset.portal_user_id)) {
      resolvedEmployee = await rhAssetAssignmentProfileFetch({
        employeeId: asset.rh_employee_id,
        portalUserId: asset.portal_user_id,
      }).catch(() => null);
    }
    printWindow.document.open();
    printWindow.document.write(buildRemissionHtml({ asset, employeeProfile: resolvedEmployee, actorName: currentActorName() }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 500);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}

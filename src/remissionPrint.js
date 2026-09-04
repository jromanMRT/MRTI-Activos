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
  const area = employeeProfile?.area_name || asset.area;
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
    body { margin: 0; background: #fff; color: #111; font-family: Arial, sans-serif; font-size: 8.5pt; }
    .page { width: 210mm; margin: 0 auto; padding: 7mm 9mm; }
    .header { display: flex; justify-content: space-between; gap: 12mm; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 4px; }
    .company { font-size: 13pt; font-weight: 700; }
    .title { margin-top: 2px; font-size: 11pt; font-weight: 700; }
    .document-meta { flex: 0 0 62mm; text-align: right; font-size: 7.5pt; line-height: 1.35; }
    .document-number { font-size: 9.5pt; font-weight: 700; }
    .section-title { margin-top: 5px; padding: 3px 5px; background: #404040; color: #fff; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #111; padding: 3px 5px; vertical-align: top; }
    th { background: #d8d8d8; text-align: left; }
    .conditions { margin-top: 5px; border: 1px solid #111; padding: 5px; font-size: 7.2pt; line-height: 1.3; }
    .conditions p { margin: 0 0 2px; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
    .signature { min-height: 37px; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 7.5pt; }
    .footer { margin-top: 4px; color: #555; text-align: right; font-size: 6.8pt; }
    @page { size: letter portrait; margin: 5mm; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } .page { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <div><div class="company">${value(company)}</div><div class="title">REMISIÓN DE ENTREGA DE EQUIPO</div></div>
      <div class="document-meta">
        <div class="document-number">No. remisión: ${value(asset.center_code)}</div>
        <div>Activo fijo: ${value(asset.cod_activo_fijo)}</div>
        <div>Fecha: ${value(generatedDate)}</div>
        <div>Generó: ${value(actorName)}</div>
        <div>MRTI Activos · Remisión v3</div>
      </div>
    </header>

    <div class="section-title">Descripción del equipo</div>
    <table>
      <tr><th style="width:16%">Marca / modelo</th><td style="width:32%">${value(asset.marca)}<br>${value(asset.modelo)}</td><th style="width:14%">Service tag</th><td>${value(asset.service_tag)}</td><th style="width:10%">Serie</th><td>${value(asset.numero_serie)}</td></tr>
      <tr><th>Tipo</th><td>${value(asset.tipo)}</td><th>Cuenta contable</th><td>${value(asset.cuenta_contable)}</td><th>Estado</th><td>${value(asset.estado)}</td></tr>
      <tr><th>Descripción</th><td colspan="5">${value(asset.descripcion || asset.esp_tec)}</td></tr>
    </table>

    <div class="section-title">Datos del empleado / asignación</div>
    <table>
      <tr><th style="width:16%">No. empleado</th><td>${value(employeeNumber)}</td><th style="width:14%">Empleado</th><td>${value(employeeName)}</td><th style="width:10%">Celular</th><td>${value(phone)}</td></tr>
      <tr><th>Puesto</th><td>${value(jobTitle)}</td><th>Unidad destino</th><td>${value(unit)}</td><th>Área</th><td>${value(area)}</td></tr>
    </table>

    <div class="section-title">Cuentas de acceso (sin contraseñas)</div>
    <table>
      <tr><th style="width:27%">Cuenta</th><th style="width:38%">Usuario</th><th>Licencia / suscripción</th></tr>
      <tr><td>Windows local</td><td>${value(asset.win_usuario || asset.win_cuenta)}</td><td>${EMPTY_VALUE}</td></tr>
      <tr><td>Microsoft 365</td><td>${value(asset.ms_usuario || asset.ms_cuenta || asset.correo_corporativo)}</td><td>${value(asset.ms_licencia || asset.ms_suscripcion)}</td></tr>
      <tr><td>Correo MRT</td><td>${value(asset.correo_mrt)}</td><td>${EMPTY_VALUE}</td></tr>
      <tr><td>Correo corporativo</td><td>${value(asset.correo_corporativo)}</td><td>${EMPTY_VALUE}</td></tr>
      <tr><td>Dropbox</td><td>${value(asset.db_usuario || asset.db_cuenta)}</td><td>${value(asset.db_licencia)}</td></tr>
    </table>

    <div class="section-title">Software incluido / licencias</div>
    <table>
      <tr><th style="width:27%">Concepto</th><th>Detalle</th></tr>
      <tr><td>Software incluido</td><td>${value(asset.software_incluido)}</td></tr>
      <tr><td>Versión / especificaciones</td><td>${value([asset.version, asset.esp_tec].filter(Boolean).join(' · '))}</td></tr>
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
      <div class="signature"><strong>${value(responsibleSignature, '')}</strong><br>Responsable del equipo</div>
      <div class="signature">Nombre, firma y fecha<br>Recepción RH / devolución de equipo</div>
      <div class="signature">Nombre, firma y fecha<br>Autorización TI</div>
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

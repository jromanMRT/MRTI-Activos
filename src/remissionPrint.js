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

function currentProfile() {
  try {
    return JSON.parse(localStorage.getItem('auth_profile') || '{}');
  } catch {
    return {};
  }
}

function calendarDate(date) {
  const day = date.getDate();
  const month = date.toLocaleString('es-MX', { month: 'short' }).replace('.', '');
  return `${day}-${month}-${String(date.getFullYear()).slice(-2)}`;
}

export function buildRemissionHtml({ asset, credentials = {}, employeeProfile = null, actorName = 'MRTI Activos', generatedAt = new Date() }) {
  const employeeNumber = employeeProfile?.employee_number || asset.id_empleado;
  const employeeName = employeeProfile?.full_name || asset.usuario_asignado;
  const phone = employeeProfile?.phone || asset.cel_empleado;
  // La empresa es laboral (RH); la unidad destino pertenece al activo.
  const company = employeeProfile?.company_name || asset.empresa || 'Minera Río Tinto';
  const unit = asset.unidad;
  const jobTitle = employeeProfile?.job_title || asset.correo_puesto;
  const generatedDate = calendarDate(generatedAt);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remisión ${value(asset.center_code, '')}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9pt;color:#000;background:#fff}
    html,body{height:auto!important;width:100%}
    .page{width:100%;max-width:205.9mm;padding:3mm 5mm 0;margin:0 auto}
    @page{margin:5mm;size:215.9mm 279.4mm}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px}
    .empresa{font-size:13pt;font-weight:bold}
    .titulo{font-size:11pt;font-weight:bold;text-align:center;margin-top:2px}
    .remision-info{text-align:right;font-size:8pt}
    .remision-num{font-size:10pt;font-weight:bold}
    table{width:100%;border-collapse:collapse;margin-bottom:5px}
    th,td{border:1px solid #000;padding:3px 5px;font-size:8.5pt;vertical-align:top}
    th{background:#d0d0d0;font-weight:bold;text-align:left}
    .section-title{background:#404040;color:#fff;font-weight:bold;font-size:8.5pt;padding:3px 5px;margin-top:6px;margin-bottom:2px}
    .condiciones{border:1px solid #000;padding:5px;font-size:7.5pt;margin-top:5px}
    .condiciones p{margin-bottom:2px}
    .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:15px}
    .firma-box{border-top:1px solid #000;padding-top:4px;text-align:center;font-size:8pt}
    .footer-info{font-size:7pt;color:#555;text-align:right;margin-top:3px}
    table,.condiciones,.firmas{break-inside:avoid;page-break-inside:avoid}
    .pin-box{border:2px solid #000;display:inline-block;padding:2px 8px;font-size:9pt;font-weight:bold}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{height:auto!important;overflow:visible!important}.page{width:100%;max-width:none;padding:3mm 4mm 0;page-break-after:avoid!important;page-break-inside:avoid!important}@page{margin:5mm;size:215.9mm 279.4mm}}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div><div class="empresa">${value(company)}</div><div class="titulo">REMISION DE ENTREGA DE EQUIPO</div></div>
      <div class="remision-info">
        <div class="remision-num">No Remision: ${value(asset.center_code)} Rev ${value(asset.cod_activo_fijo, '0')}</div>
        <div>Fecha: ${value(generatedDate)}</div>
        <div>Pagina 1</div>
        <div>Autor: ${value(actorName)}</div>
        <div>Remision V 2.0-2023</div>
      </div>
    </div>

    <div class="section-title">Descripcion del Equipo</div>
    <table>
      <tr><th style="width:15%">Marca/Modelo</th><td style="width:35%">${value(asset.marca, '')}<br>${value(asset.modelo, '')}</td><th style="width:12%">Service TAG</th><td style="width:18%">${value(asset.service_tag)}</td><th style="width:8%">PIN</th><td>${value(asset.service_tag)}</td></tr>
      <tr><th>Tipo</th><td>${value(asset.tipo)}</td><th>Serie</th><td>${value(asset.numero_serie)}</td><th>Activo Fijo</th><td>${value(asset.cuenta_contable)}</td></tr>
      <tr><th colspan="1">Descripcion</th><td colspan="5">${value(asset.descripcion || asset.esp_tec)}</td></tr>
    </table>

    <div class="section-title">Datos del Empleado / Asignacion</div>
    <table>
      <tr><th style="width:15%">No Empleado</th><td style="width:20%">${value(employeeNumber)}</td><th style="width:15%">Empleado</th><td style="width:25%">${value(employeeName)}</td><th style="width:12%">Cel</th><td>${value(phone)}</td></tr>
      <tr><th>Puesto</th><td>${value(jobTitle)}</td><th>Unidad Destino</th><td>${value(unit)}</td><th>Contabilidad</th><td>${value(asset.cuenta_contable)}</td></tr>
    </table>

    <div class="section-title">Caracteristicas de Acceso / Credenciales</div>
    <table>
      <tr><th style="width:30%">Cuenta</th><th style="width:35%">Usuario</th><th>Password</th></tr>
      <tr><td>Usuario Windows Local</td><td>${value(asset.win_usuario)}</td><td>${value(credentials.win_password)}</td></tr>
      <tr><td>Cuenta Microsoft / Office</td><td>${value(asset.ms_usuario || asset.ms_cuenta || asset.cuenta_microsoft)}</td><td>${value(credentials.ms_password)}</td></tr>
      <tr><td>Correo Autorizado (MRT)</td><td>${value(asset.correo_mrt)}</td><td>${value(credentials.password_mrt)}</td></tr>
      <tr><td>Correo Corporativo</td><td>${value(asset.correo_corporativo)}</td><td>${value(credentials.password_corporativo)}</td></tr>
      <tr><td>DropBox</td><td>${value(asset.db_usuario, 'Sin cuenta')}</td><td>${value(credentials.db_password)}</td></tr>
    </table>

    <div class="section-title">Software Incluido / Licencias</div>
    <table>
      <tr><th style="width:30%">Concepto</th><th>Detalle</th></tr>
      <tr><td>Software incluido</td><td>${value(asset.software_incluido)}</td></tr>
      <tr><td>Microsoft / Office 365</td><td>${value(asset.ms_suscripcion)}</td></tr>
      <tr><td>DropBox</td><td>${value(asset.db_licencia)}</td></tr>
      <tr><td>Antivirus (Comentario)</td><td>${value(asset.av_comentario || asset.av_team)}</td></tr>
    </table>

    <div class="condiciones">
      <p><strong>CONDICIONES DE USO Y RESGUARDO:</strong></p>
      <p>1.- EL EQUIPO DEBE PERMANECER EN BUENAS CONDICIONES DE USO.</p>
      <p>2.- EN CASO QUE PRESENTE FALLAS DE SOFTWARE O HARDWARE, DEBIDO AL USO NORMAL, SERAN ENVIADAS A DEPTO DE SISTEMAS PARA SU DIAGNOSTICO Y REPARACION.</p>
      <p>3.- LA PERSONA RESPONSABLE DEL RESGUARDO DEBERA REPONER LA HERRAMIENTA O EQUIPO EXTRAVIADO O DANIADO POR USO INADECUADO EL COSTO DE REPOSICION.</p>
      <p>4.- EL EQUIPO PODRA SER AUDITADO, TANTO EN SOFTWARE COMO HARDWARE EN CUALQUIER MOMENTO.</p>
      <p>5.- LA HERRAMIENTA O TELEFONO DEBERA ENTREGARSE AL DEPTO. CORRESPONDIENTE AL MOMENTO DE TERMINARSE LA NECESIDAD DE USO.</p>
      <p>6.- EL EQUIPO SE ENCUENTRA CONFIGURADO E INSTALADO CON EL SOFTWARE LEGAL ADQUIRIDO POR LA EMPRESA. EL MAL USO O INSTALACION DE SOFTWARE ILEGAL, ES RESPONSABILIDAD DEL USUARIO.</p>
      <p>7.- PROHIBIDO ESTRICTAMENTE LA INSTALACION DE SOFTWARE NO RECOMENDADO.</p>
    </div>

    <div class="firmas">
      <div class="firma-box"><br><br><strong>${value(employeeNumber, '')} // ${value(employeeName, '')}</strong><br>Responsable del Equipo</div>
      <div class="firma-box"><br><br>Nombre, Firma y Fecha<br>Envio RH - Recepcion de Equipo</div>
      <div class="firma-box"><br><br>Nombre, Firma y Fecha<br>Autorizacion TI</div>
    </div>
    <div class="footer-info">${value(asset.center_code)} | ${value(asset.service_tag, '')} | Generado: ${value(generatedAt.toLocaleDateString('es-MX'))}</div>
  </div>
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
    const profile = currentProfile();
    const [response, credentialResponse] = await Promise.all([
      apiFetch(`/activos/${assetId}`),
      apiFetch(`/activos/${assetId}/remission-credentials`),
    ]);
    const asset = response.data;
    let resolvedEmployee = employeeProfile;
    if (!resolvedEmployee && (asset.rh_employee_id || asset.portal_user_id)) {
      resolvedEmployee = await rhAssetAssignmentProfileFetch({
        employeeId: asset.rh_employee_id,
        portalUserId: asset.portal_user_id,
      }).catch(() => null);
    }
    printWindow.document.open();
    printWindow.document.write(buildRemissionHtml({
      asset,
      credentials: credentialResponse.data || {},
      employeeProfile: resolvedEmployee,
      actorName: profile.full_name || 'MRTI Activos',
    }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 500);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}

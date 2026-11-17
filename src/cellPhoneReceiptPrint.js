import { apiFetch } from './api.js';
import { escapeRemissionHtml } from './remissionPrint.js';

const EMPTY = '—';
function v(val, fallback = EMPTY) {
  const s = String(val ?? '').trim();
  return escapeRemissionHtml(s || fallback);
}

function currentProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

function calendarDate(d) {
  const month = d.toLocaleString('es-MX', { month: 'short' }).replace('.', '');
  return `${d.getDate()}-${month}-${String(d.getFullYear()).slice(-2)}`;
}

export function buildCellPhoneReceiptHtml({ phone, actorName = 'MRTI Activos', generatedAt = new Date() }) {
  const date = calendarDate(generatedAt);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Recibo Celular ${v(phone.numero_linea, '')}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:Letter portrait;margin:6mm}
    html,body{width:100%;min-height:100%;background:#e7e7e7}
    body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;line-height:1.2;color:#000}
    .page{display:flex;min-height:267.4mm;width:203.9mm;margin:8mm auto;padding:3mm;background:#fff;box-shadow:0 2mm 8mm #0003}
    .sheet{display:flex;min-width:0;flex:1;flex-direction:column}
    .header{display:flex;justify-content:space-between;align-items:flex-start;gap:7mm;border-bottom:2px solid #000;padding-bottom:1.5mm;margin-bottom:1.5mm}
    .header>div:first-child{min-width:0;flex:1}
    .empresa{font-size:13pt;font-weight:bold;line-height:1.1;overflow-wrap:anywhere}
    .titulo{font-size:11pt;font-weight:bold;margin-top:.7mm}
    .info{flex:0 0 60mm;text-align:right;font-size:8.5pt;line-height:1.3}
    .info-num{font-size:10pt;font-weight:bold}
    table{width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:1.5mm}
    th,td{border:1px solid #000;padding:.9mm 1.5mm;font-size:8.7pt;line-height:1.15;vertical-align:top;overflow-wrap:anywhere}
    th{background:#d0d0d0;font-weight:bold;text-align:left}
    .section-title{background:#404040;color:#fff;font-weight:bold;font-size:8.7pt;line-height:1.15;padding:.9mm 1.5mm;margin-top:1mm;margin-bottom:.5mm}
    .condiciones{border:1px solid #000;padding:1.5mm;font-size:8pt;line-height:1.15;margin-top:1mm}
    .condiciones p{margin-bottom:.45mm}
    .condiciones p:last-child{margin-bottom:0}
    .signatures{margin-top:auto;padding-top:6mm}
    .firmas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm}
    .firma-box{min-height:15mm;border-top:1px solid #000;padding-top:1.2mm;text-align:center;font-size:8pt;line-height:1.2}
    .footer-info{font-size:7.5pt;color:#555;text-align:right;margin-top:1.5mm}
    table,.header,.condiciones,.signatures{break-inside:avoid;page-break-inside:avoid}
    @media print{
      html,body{min-height:0;background:#fff}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{width:203.9mm;min-height:267.4mm;margin:0;padding:3mm;box-shadow:none;break-after:avoid;page-break-after:avoid}
    }
  </style>
</head>
<body>
  <div class="page"><div class="sheet">
    <div class="header">
      <div><div class="empresa">Minera Río Tinto</div><div class="titulo">RECIBO DE ENTREGA DE TELÉFONO CELULAR</div></div>
      <div class="info">
        <div class="info-num">Línea: ${v(phone.numero_linea)}</div>
        <div>Fecha: ${v(date)}</div>
        <div>Autor: ${v(actorName)}</div>
      </div>
    </div>

    <div class="section-title">Datos del Equipo</div>
    <table>
      <tr><th style="width:18%">Marca</th><td style="width:32%">${v(phone.marca)}</td><th style="width:18%">Modelo</th><td style="width:32%">${v(phone.modelo)}</td></tr>
      <tr><th>IMEI</th><td>${v(phone.imei)}</td><th>No. Serie</th><td>${v(phone.numero_serie)}</td></tr>
      <tr><th>Operador</th><td>${v(phone.operador)}</td><th>Plan</th><td>${v(phone.plan_datos)}</td></tr>
      <tr><th>Importe mensual</th><td>${v(phone.importe_mes)}</td><th>Estado</th><td>${v(phone.estado)}</td></tr>
    </table>

    <div class="section-title">Datos del Usuario / Asignación</div>
    <table>
      <tr><th style="width:18%">Usuario asignado</th><td style="width:32%">${v(phone.usuario)}</td><th style="width:18%">Unidad</th><td style="width:32%">${v(phone.unidad)}</td></tr>
      <tr><th>Departamento</th><td>${v(phone.departamento)}</td><th>Fecha de entrega</th><td>${v(phone.fecha_entrega)}</td></tr>
      <tr><th>No. Línea / Teléfono</th><td colspan="3">${v(phone.numero_linea)}</td></tr>
    </table>

    ${phone.comentario ? `<div class="section-title">Observaciones</div>
    <table><tr><td>${v(phone.comentario)}</td></tr></table>` : ''}

    <div class="condiciones">
      <p><strong>CONDICIONES DE USO Y RESGUARDO:</strong></p>
      <p>1.- EL EQUIPO DEBE PERMANECER EN BUENAS CONDICIONES DE USO Y SER UTILIZADO ÚNICAMENTE PARA FINES LABORALES.</p>
      <p>2.- EN CASO DE FALLAS DE SOFTWARE O HARDWARE DEBIDO AL USO NORMAL, DEBERÁ SER REPORTADO AL DEPTO. DE SISTEMAS PARA SU DIAGNÓSTICO Y REPARACIÓN.</p>
      <p>3.- LA PERSONA RESPONSABLE DEL RESGUARDO DEBERÁ REPONER EL EQUIPO EXTRAVIADO O DAÑADO POR USO INADECUADO CON EL COSTO DE REPOSICIÓN.</p>
      <p>4.- EL EQUIPO PODRÁ SER AUDITADO EN CUALQUIER MOMENTO POR EL DEPTO. DE SISTEMAS.</p>
      <p>5.- EL TELÉFONO DEBERÁ ENTREGARSE AL DEPTO. CORRESPONDIENTE AL MOMENTO DE TERMINARSE LA NECESIDAD DE USO O AL CAUSAR BAJA.</p>
      <p>6.- QUEDA PROHIBIDA LA INSTALACIÓN DE APLICACIONES NO AUTORIZADAS POR LA EMPRESA.</p>
      <p>7.- EL USO DEL PLAN DE DATOS ES EXCLUSIVAMENTE PARA ACTIVIDADES LABORALES. EL EXCESO EN EL CONSUMO SERÁ RESPONSABILIDAD DEL USUARIO.</p>
    </div>

    <div class="signatures">
      <div class="firmas">
        <div class="firma-box"><strong>${v(phone.usuario, '')}</strong><br>Responsable del Equipo</div>
        <div class="firma-box">Nombre, Firma y Fecha<br>Entrega RH</div>
        <div class="firma-box">Nombre, Firma y Fecha<br>Autorización TI</div>
      </div>
      <div class="footer-info">Línea: ${v(phone.numero_linea, '')} | IMEI: ${v(phone.imei, '')} | Generado: ${v(generatedAt.toLocaleDateString('es-MX'))}</div>
    </div>
  </div></div>
</body>
</html>`;
}

export async function openCellPhoneReceipt(phoneRow) {
  const printWindow = window.open('', '_blank', 'width=960,height=760');
  if (!printWindow) throw new Error('Permite las ventanas emergentes para imprimir el recibo.');
  printWindow.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Preparando recibo</title></head><body style="font:16px Arial;padding:32px">Preparando recibo…</body></html>');
  printWindow.document.close();

  try {
    const profile = currentProfile();
    printWindow.document.open();
    printWindow.document.write(buildCellPhoneReceiptHtml({
      phone: phoneRow,
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

import { escapeRemissionHtml as esc } from './remissionPrint.js';

const dateText = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function groupBySection(steps) {
  const sections = [];
  for (const step of steps) {
    let section = sections.find((item) => item.name === step.section);
    if (!section) { section = { name: step.section, steps: [] }; sections.push(section); }
    section.steps.push(step);
  }
  return sections;
}

// Hoja carta para marcar a mano. Con `checklist` refleja lo ya registrado
// (✓ hecho, N/A no aplica, con fecha y quién); sin él sale en blanco desde
// la plantilla, para imprimir antes de dar de alta el equipo.
export function buildSetupChecklistHtml({ steps, asset = null, checklist = null, generatedAt = new Date() }) {
  const mark = (status) => status === 'done' ? '✓' : status === 'na' ? 'N/A' : '';
  const rows = groupBySection(steps).map((section) => `
    <tr class="section"><td colspan="4">${esc(section.name)}</td></tr>
    ${section.steps.map((step) => `<tr>
      <td class="box"><span class="${step.status === 'na' ? 'na' : ''}">${mark(step.status)}</span></td>
      <td>${esc(step.label)}${step.help_text ? `<small>${esc(step.help_text)}</small>` : ''}${step.note ? `<small>Nota: ${esc(step.note)}</small>` : ''}</td>
      <td class="when">${esc(dateText(step.done_at))}</td>
      <td class="who">${esc(step.done_by_name || '')}</td>
    </tr>`).join('')}`).join('');
  const field = (label, value) => `<div><span>${label}</span><strong>${esc(value || '') || '&nbsp;'}</strong></div>`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Checklist de preparación ${esc(asset?.center_code || '')}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:Letter portrait;margin:10mm}
    body{font-family:Arial,Helvetica,sans-serif;font-size:9.5pt;color:#000;background:#fff}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:2mm;margin-bottom:3mm}
    h1{font-size:14pt}.sub{font-size:9pt;color:#333;margin-top:1mm}.meta{text-align:right;font-size:8.5pt;line-height:1.4}
    .fields{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm 5mm;margin-bottom:3mm}
    .fields div{border-bottom:1px solid #000;padding:1mm 0;display:flex;gap:2mm;align-items:baseline;min-height:6mm}
    .fields span{font-size:7.5pt;text-transform:uppercase;color:#444;white-space:nowrap}
    table{width:100%;border-collapse:collapse}
    th{font-size:7.5pt;text-transform:uppercase;text-align:left;border-bottom:1.5px solid #000;padding:1mm}
    td{border-bottom:1px solid #bbb;padding:1.3mm 1mm;vertical-align:top}
    tr{page-break-inside:avoid}
    .section td{background:#e9e9e9;font-weight:bold;font-size:9pt;border-bottom:1px solid #000;padding-top:2mm}
    .box{width:9mm;text-align:center}.box span{display:inline-block;width:5mm;height:5mm;border:1.5px solid #000;line-height:4.4mm;font-weight:bold;font-size:9pt}
    .box span.na{width:auto;min-width:5mm;font-size:6.5pt;padding:0 .5mm}
    small{display:block;color:#555;font-size:7.5pt;margin-top:.5mm}
    .when{width:22mm}.who{width:38mm}
    .notes{margin-top:4mm;border:1px solid #000;min-height:18mm;padding:1.5mm;font-size:8.5pt}
    .notes b{display:block;font-size:7.5pt;text-transform:uppercase;margin-bottom:1mm}
    .signs{display:grid;grid-template-columns:1fr 1fr;gap:15mm;margin-top:12mm;text-align:center;font-size:8.5pt}
    .signs div{border-top:1px solid #000;padding-top:1mm}
    @media screen{body{padding:10mm;max-width:216mm;margin:auto}}
  </style>
</head>
<body>
  <div class="top">
    <div><h1>Checklist de preparación de equipo</h1><p class="sub">Minera Río Tinto · Departamento de TI</p></div>
    <div class="meta">Impreso: ${esc(dateText(generatedAt))}${checklist ? `<br>Iniciado: ${esc(dateText(checklist.created_at))} · ${esc(checklist.started_by_name || '')}` : ''}${checklist?.completed_at ? `<br>Cerrado: ${esc(dateText(checklist.completed_at))} · ${esc(checklist.completed_by_name || '')}` : ''}</div>
  </div>
  <div class="fields">
    ${field('Código', asset?.center_code)}${field('Equipo', [asset?.marca, asset?.modelo].filter(Boolean).join(' ') || asset?.descripcion)}${field('Serie / service tag', asset?.numero_serie || asset?.service_tag)}
    ${field('Usuario', asset?.usuario_asignado)}${field('Unidad', asset?.unidad)}${field('Técnico', checklist?.started_by_name)}
  </div>
  <table>
    <thead><tr><th>Hecho</th><th>Paso</th><th>Fecha</th><th>Realizó</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="notes"><b>Observaciones</b>${esc(checklist?.notes || '')}</div>
  <div class="signs"><div>Técnico que preparó el equipo</div><div>Usuario que recibe</div></div>
</body>
</html>`;
}

export function openSetupChecklistPrint(options) {
  const printWindow = window.open('', '_blank', 'width=960,height=760');
  if (!printWindow) throw new Error('Permite las ventanas emergentes para imprimir el checklist.');
  printWindow.document.open();
  printWindow.document.write(buildSetupChecklistHtml(options));
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 400);
}

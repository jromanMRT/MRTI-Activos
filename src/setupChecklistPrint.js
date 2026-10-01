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

// Iniciales para la columna "quién" en el espacio reducido de la hoja.
const initials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0].toUpperCase()).join('');
const shortDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// Hoja carta compacta a dos columnas para marcar a mano. Con `checklist`
// refleja lo ya registrado (✓ hecho, N/A no aplica, con fecha e iniciales);
// sin él sale en blanco desde la plantilla. Cada sección se mantiene
// completa dentro de una columna para que no se parta.
export function buildSetupChecklistHtml({ steps, asset = null, checklist = null, generatedAt = new Date() }) {
  const mark = (status) => status === 'done' ? '✓' : status === 'na' ? 'N/A' : '';
  const blocks = groupBySection(steps).map((section) => `<section>
    <h2>${esc(section.name)}</h2>
    ${section.steps.map((step) => `<div class="step">
      <span class="box${step.status === 'na' ? ' na' : ''}">${mark(step.status)}</span>
      <span class="label">${esc(step.label)}${step.note ? `<em>${esc(step.note)}</em>` : ''}</span>
      <span class="when">${step.done_at ? `${esc(shortDate(step.done_at))} ${esc(initials(step.done_by_name))}` : ''}</span>
    </div>`).join('')}
  </section>`).join('');
  const field = (label, value, wide = false) => `<div${wide ? ' class="wide"' : ''}><span>${label}</span><strong>${esc(value || '') || '&nbsp;'}</strong></div>`;
  const equipment = [asset?.marca, asset?.modelo].filter(Boolean).join(' ') || asset?.descripcion;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Checklist de preparación ${esc(asset?.center_code || '')}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    @page{size:Letter portrait;margin:9mm 10mm}
    body{font-family:Arial,Helvetica,sans-serif;font-size:7.8pt;line-height:1.2;color:#000;background:#fff}
    .top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #000;padding-bottom:1.2mm;margin-bottom:2mm}
    h1{font-size:11.5pt}.sub{font-size:7.5pt;color:#333}.meta{text-align:right;font-size:7pt;line-height:1.35}
    .fields{display:grid;grid-template-columns:1fr 1.6fr 1.3fr;gap:1mm 4mm;margin-bottom:2.5mm}
    .fields div{border-bottom:.8px solid #000;display:flex;gap:1.5mm;align-items:baseline;min-height:5mm;padding-bottom:.3mm;min-width:0}
    .fields span{font-size:6.3pt;text-transform:uppercase;color:#444;white-space:nowrap}
    .fields strong{font-size:8pt;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legend{font-size:6.5pt;color:#444;margin-bottom:1.5mm}
    .cols{column-count:2;column-gap:6mm;column-rule:.5px solid #ccc}
    section{break-inside:avoid;margin-bottom:2mm}
    h2{font-size:7.6pt;text-transform:uppercase;letter-spacing:.3px;background:#e6e6e6;padding:.7mm 1.2mm;margin-bottom:.4mm}
    .step{display:flex;align-items:flex-start;gap:1.6mm;padding:.75mm .5mm;border-bottom:.5px solid #d4d4d4}
    .box{flex:0 0 3.6mm;height:3.6mm;border:1.1px solid #000;text-align:center;font-weight:bold;font-size:7pt;line-height:3.2mm}
    .box.na{flex-basis:auto;min-width:3.6mm;font-size:5pt;padding:0 .3mm}
    .label{flex:1;min-width:0}
    .label em{display:block;font-style:normal;color:#555;font-size:6.5pt}
    .when{flex:0 0 15mm;border-bottom:.6px dotted #888;min-height:3.4mm;font-size:6.3pt;color:#333;text-align:right;white-space:nowrap}
    .bottom{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:5mm;margin-top:2mm;align-items:end}
    .notes{border:.8px solid #000;min-height:14mm;padding:1mm;font-size:7pt}
    .notes b{display:block;font-size:6.3pt;text-transform:uppercase;margin-bottom:.6mm}
    .sign{border-top:.8px solid #000;padding-top:.8mm;text-align:center;font-size:7pt}
    @media screen{body{padding:9mm 10mm;max-width:216mm;margin:auto}}
  </style>
</head>
<body>
  <div class="top">
    <div><h1>Checklist de preparación de equipo</h1><p class="sub">Minera Río Tinto · Departamento de TI</p></div>
    <div class="meta">Impreso: ${esc(dateText(generatedAt))}${checklist ? `<br>Iniciado: ${esc(dateText(checklist.created_at))} · ${esc(checklist.started_by_name || '')}` : ''}${checklist?.completed_at ? `<br>Cerrado: ${esc(dateText(checklist.completed_at))} · ${esc(checklist.completed_by_name || '')}` : ''}</div>
  </div>
  <div class="fields">
    ${field('Código', asset?.center_code)}${field('Equipo', equipment)}${field('Serie', asset?.numero_serie || asset?.service_tag)}
    ${field('Unidad', asset?.unidad)}${field('Usuario', asset?.usuario_asignado)}${field('Técnico', checklist?.started_by_name)}
  </div>
  <p class="legend">Marca ✓ al terminar cada paso o escribe N/A si no aplica. A la derecha: fecha e iniciales de quien lo hizo.</p>
  <div class="cols">${blocks}</div>
  <div class="bottom">
    <div class="notes"><b>Observaciones</b>${esc(checklist?.notes || '')}</div>
    <div class="sign">Técnico que preparó el equipo</div>
    <div class="sign">Usuario que recibe</div>
  </div>
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

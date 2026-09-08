import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiUpload, rhAssetAssignmentProfilesFetch } from '../api.js';

const STATUS = {
  pending: { label: 'Pendiente de devolución', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  not_returned: { label: 'No devuelto', tone: 'border-red-500/30 bg-red-500/10 text-red-300' },
  returned: { label: 'Devuelto', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
};
const CONDITIONS = { good: 'Buen estado', fair: 'Desgaste normal', damaged: 'Dañado', incomplete: 'Incompleto' };
const DESTINATIONS = { available: 'Disponible para reasignar', maintenance: 'Enviar a mantenimiento', retired: 'Baja del equipo' };
const ACCESSORIES = { charger: 'Cargador', bag: 'Mochila/estuche', monitor: 'Monitor', phone: 'Teléfono', keyboard_mouse: 'Teclado y mouse', other: 'Otro' };

function today() { const date = new Date(); const pad = (value) => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function reference(row) { return row.rh_employee_id ? { employee_id: row.rh_employee_id } : row.portal_user_id ? { portal_user_id: row.portal_user_id } : null; }
function profileKey(value, type) { return `${type}:${value}`; }
function rowKey(row) { return row.rh_employee_id ? profileKey(row.rh_employee_id, 'employee') : profileKey(row.portal_user_id, 'portal'); }
function fullAssetName(row) { return [row.tipo, row.marca, row.modelo].filter(Boolean).join(' ') || row.descripcion || 'Activo'; }

async function loadData() {
  const result = await apiFetch('/activos/offboarding');
  const allRows = [...result.data.open, ...result.data.history];
  const seen = new Set();
  const references = allRows.map(reference).filter((item) => {
    const key = item.employee_id ? profileKey(item.employee_id, 'employee') : profileKey(item.portal_user_id, 'portal');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const profiles = references.length ? await rhAssetAssignmentProfilesFetch(references) : [];
  const map = new Map();
  for (const item of profiles) {
    map.set(profileKey(item.id, 'employee'), item);
    if (item.portal_user_id) map.set(profileKey(item.portal_user_id, 'portal'), item);
  }
  const enrich = (row) => ({ ...row, employee: map.get(rowKey(row)) || null });
  return { open: result.data.open.map(enrich), history: result.data.history.map(enrich) };
}

export function EmployeeOffboardingPage() {
  const [data, setData] = useState({ open: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  async function refresh() {
    setLoading(true); setError('');
    try { setData(await loadData()); } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  const pending = useMemo(() => data.open.filter((row) => (row.employee && row.employee.employment_status !== 'active') || row.offboarding_id), [data.open]);
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const row of pending) {
      const key = rowKey(row);
      if (!groups.has(key)) groups.set(key, { employee: row.employee, fallbackName: row.usuario_asignado, rows: [] });
      groups.get(key).rows.push(row);
    }
    return [...groups.values()];
  }, [pending]);
  const notReturned = pending.filter((row) => row.return_status === 'not_returned').length;
  const trackedPending = pending.filter((row) => !row.return_status || row.return_status === 'pending').length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-amber-400">Salida de personal</p><h1 className="mt-1 text-3xl font-bold">Devolución de activos</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">RH registra la baja laboral; aquí se confirma qué equipo regresó, en qué condición y cuál será su destino. La asignación permanece abierta hasta recibirlo.</p></div>
        <button type="button" onClick={refresh} disabled={loading} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Actualizar</button>
      </header>
      {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</p>}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Personas con pendientes" value={grouped.length} />
        <Summary label="Equipos pendientes" value={trackedPending} tone="text-amber-300" />
        <Summary label="No devueltos" value={notReturned} tone="text-red-300" />
        <Summary label="Devoluciones registradas" value={data.history.length} tone="text-emerald-300" />
      </section>
      {loading ? <p className="py-16 text-center text-slate-500">Consultando bajas y asignaciones vigentes…</p> : grouped.length === 0 ? (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-10 text-center"><p className="text-lg font-semibold text-emerald-300">No hay equipos pendientes por bajas detectadas</p><p className="mt-2 text-sm text-slate-500">Cuando RH marque una ficha como baja y conserve activos asignados, aparecerá automáticamente aquí.</p></section>
      ) : <section className="space-y-4">{grouped.map((group) => <EmployeeCase key={group.rows[0].assignment_id} group={group} onSelect={setSelected} />)}</section>}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/45">
        <button type="button" onClick={() => setHistoryVisible((value) => !value)} className="flex w-full items-center justify-between px-5 py-4 text-left"><span><strong>Historial de devoluciones</strong><small className="ml-2 text-slate-500">{data.history.length} registros</small></span><span aria-hidden="true">{historyVisible ? '−' : '+'}</span></button>
        {historyVisible && <div className="border-t border-slate-800 p-4">{data.history.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="p-3">Fecha</th><th className="p-3">Empleado</th><th className="p-3">Activo</th><th className="p-3">Condición</th><th className="p-3">Destino</th><th className="p-3"></th></tr></thead><tbody>{data.history.map((row) => <tr key={row.assignment_id} className="border-t border-slate-800"><td className="p-3">{formatDate(row.returned_at)}</td><td className="p-3">{row.employee?.full_name || row.usuario_asignado || 'Ficha no disponible'}</td><td className="p-3">{row.center_code} · {fullAssetName(row)}</td><td className="p-3">{CONDITIONS[row.condition_state] || '—'}</td><td className="p-3">{DESTINATIONS[row.destination] || '—'}</td><td className="p-3 text-right"><button type="button" onClick={() => printReceipt(row)} className="text-sky-400 hover:underline">Imprimir constancia</button></td></tr>)}</tbody></table></div> : <p className="p-4 text-center text-slate-500">Todavía no hay devoluciones cerradas.</p>}</div>}
      </section>
      {selected && <ReturnModal row={selected} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await refresh(); }} />}
    </div>
  );
}

function Summary({ label, value, tone = 'text-slate-100' }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${tone}`}>{value}</p></div>; }

function EmployeeCase({ group, onSelect }) {
  const employee = group.employee;
  return <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div><h2 className="text-lg font-bold">{employee?.full_name || group.fallbackName || 'Empleado sin ficha disponible'}</h2><p className="text-xs text-slate-500">{[employee?.employee_number, employee?.company_name, employee?.area_name].filter(Boolean).join(' · ') || 'Referencia conservada en Activos'}</p></div><span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">Baja detectada en RH</span></header><div className="divide-y divide-slate-800">{group.rows.map((row) => { const status = STATUS[row.return_status || 'pending']; return <div key={row.assignment_id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link to={`/${row.asset_id}`} className="font-semibold text-sky-400 hover:underline">{row.center_code}</Link><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>{status.label}</span></div><p className="mt-1 text-sm text-slate-300">{fullAssetName(row)}</p><p className="mt-1 text-xs text-slate-500">Asignado desde {formatDate(row.assigned_at)}{row.due_date ? ` · compromiso ${formatDate(row.due_date)}` : ''}</p></div><button type="button" onClick={() => onSelect(row)} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-bold text-[#2a1c05] hover:bg-sky-400">Procesar devolución</button></div>; })}</div></article>;
}

function ReturnModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ status: row.return_status || 'pending', due_date: String(row.due_date || '').slice(0, 10), return_date: String(row.returned_at || today()).slice(0, 10), condition_state: row.condition_state || 'good', destination: row.destination || 'available', accessories: row.accessories || [], notes: row.return_notes || '' });
  const [file, setFile] = useState(null); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  function toggleAccessory(key) { setForm((current) => ({ ...current, accessories: current.accessories.includes(key) ? current.accessories.filter((item) => item !== key) : [...current.accessories, key] })); }
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch(`/activos/offboarding/${row.assignment_id}`, { method: 'PUT', body: JSON.stringify(form) });
      if (file) {
        const upload = new FormData(); upload.append('file', file); upload.append('nombre', `Evidencia de devolución - ${row.employee?.full_name || row.usuario_asignado || row.center_code}`); upload.append('tipo', 'Otro');
        try { await apiUpload(`/activos/${row.asset_id}/documentos`, upload); }
        catch (uploadError) { window.alert(`La devolución quedó guardada, pero no fue posible adjuntar la evidencia: ${uploadError.message}. Puedes subirla después desde Documentos del activo.`); }
      }
      await onSaved();
    } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
  }
  const returned = form.status === 'returned';
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><form onSubmit={submit} className="my-4 w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"><header className="border-b border-slate-800 px-6 py-4"><p className="text-xs font-bold uppercase tracking-wider text-amber-400">Devolución por baja</p><h2 className="mt-1 text-xl font-bold">{row.center_code} · {fullAssetName(row)}</h2><p className="mt-1 text-sm text-slate-500">{row.employee?.full_name || row.usuario_asignado}</p></header><div className="space-y-5 px-6 py-5">{error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}<fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Situación actual</legend><div className="grid gap-2 sm:grid-cols-3">{Object.entries(STATUS).map(([key, item]) => <label key={key} className={`cursor-pointer rounded-xl border p-3 text-sm ${form.status === key ? item.tone : 'border-slate-800 text-slate-400'}`}><input type="radio" className="mr-2" name="status" value={key} checked={form.status === key} onChange={(event) => setForm({ ...form, status: event.target.value })} />{item.label}</label>)}</div></fieldset>{!returned && <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-400">Fecha compromiso de entrega</span><input type="date" className="input-self max-w-xs" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} /></label>}{returned && <div className="grid gap-4 sm:grid-cols-3"><Field label="Fecha de devolución"><input type="date" required className="input-self" value={form.return_date} onChange={(event) => setForm({ ...form, return_date: event.target.value })} /></Field><Field label="Condición"><select required className="input-self" value={form.condition_state} onChange={(event) => setForm({ ...form, condition_state: event.target.value })}>{Object.entries(CONDITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Destino"><select required className="input-self" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })}>{Object.entries(DESTINATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>}<fieldset><legend className="mb-2 text-xs font-semibold text-slate-400">Accesorios recibidos</legend><div className="flex flex-wrap gap-2">{Object.entries(ACCESSORIES).map(([key, label]) => <label key={key} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${form.accessories.includes(key) ? 'border-sky-500/50 bg-sky-500/15 text-sky-300' : 'border-slate-800 text-slate-500'}`}><input type="checkbox" className="sr-only" checked={form.accessories.includes(key)} onChange={() => toggleAccessory(key)} />{label}</label>)}</div></fieldset><Field label="Observaciones"><textarea className="input-self min-h-24" maxLength={4000} placeholder="Daños, faltantes, acuerdos o detalles de la recepción…" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><Field label="Evidencia opcional (PDF, JPG o PNG)"><input type="file" accept="application/pdf,image/jpeg,image/png" className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Field>{returned && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">Al guardar como devuelto se cerrará la asignación y el equipo quedará {DESTINATIONS[form.destination].toLowerCase()}. Esta devolución no podrá reabrirse.</p>}</div><footer className="flex justify-end gap-2 border-t border-slate-800 px-6 py-4"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-bold text-[#2a1c05] disabled:opacity-50">{saving ? 'Guardando…' : returned ? 'Confirmar recepción' : 'Guardar seguimiento'}</button></footer></form></div>;
}

function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>{children}</label>; }
function formatDate(value) { if (!value) return '—'; const raw = String(value); const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw); return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function printReceipt(row) {
  const popup = window.open('', '_blank'); if (!popup) return; popup.opener = null;
  const employee = row.employee?.full_name || row.usuario_asignado || 'Sin nombre';
  const accessories = (row.accessories || []).map((key) => ACCESSORIES[key] || key).join(', ') || 'Ninguno registrado';
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Constancia de devolución</title><style>@page{size:letter;margin:15mm}body{font:12px Arial;color:#111}h1{font-size:20px;margin:0}header{border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #444}.cell{padding:9px;border-bottom:1px solid #aaa}.cell:nth-child(odd){border-right:1px solid #aaa}.wide{grid-column:1/-1;border-right:0!important}.label{font-size:9px;text-transform:uppercase;color:#555}.value{font-weight:bold;margin-top:3px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #111;text-align:center;padding-top:7px}.note{margin-top:18px;font-size:10px;color:#444}</style></head><body><header><h1>CONSTANCIA DE DEVOLUCIÓN DE ACTIVO</h1><p>Minera Río Tinto · MRTI Activos</p></header><div class="grid"><div class="cell"><div class="label">Empleado</div><div class="value">${escapeHtml(employee)}</div></div><div class="cell"><div class="label">Número de empleado</div><div class="value">${escapeHtml(row.employee?.employee_number || '—')}</div></div><div class="cell"><div class="label">Código del activo</div><div class="value">${escapeHtml(row.center_code)}</div></div><div class="cell"><div class="label">Equipo</div><div class="value">${escapeHtml(fullAssetName(row))}</div></div><div class="cell"><div class="label">Serie / Service tag</div><div class="value">${escapeHtml(row.numero_serie || row.service_tag || '—')}</div></div><div class="cell"><div class="label">Fecha de devolución</div><div class="value">${escapeHtml(formatDate(row.returned_at))}</div></div><div class="cell"><div class="label">Condición</div><div class="value">${escapeHtml(CONDITIONS[row.condition_state] || '—')}</div></div><div class="cell"><div class="label">Destino</div><div class="value">${escapeHtml(DESTINATIONS[row.destination] || '—')}</div></div><div class="cell wide"><div class="label">Accesorios recibidos</div><div class="value">${escapeHtml(accessories)}</div></div><div class="cell wide"><div class="label">Observaciones</div><div class="value">${escapeHtml(row.return_notes || 'Sin observaciones')}</div></div></div><div class="signatures"><div class="signature">${escapeHtml(employee)}<br>Entrega</div><div class="signature">${escapeHtml(row.received_by_name || 'Responsable de TI')}<br>Recibe</div></div><p class="note">Esta constancia corresponde al historial interno registrado en MRTI Activos. La baja laboral permanece bajo responsabilidad de MRTI RH.</p><script>window.onload=()=>window.print()<\/script></body></html>`); popup.document.close();
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { openSetupChecklistPrint } from '../setupChecklistPrint.js';

const BASE = '/activos-suite/setup-checklist';
const profile = () => { try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; } };
const css = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
const dateTime = (value) => value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';

function ItemRow({ item, first, last, busy, onMove, onSave, onToggle }) {
  const [editing, setEditing] = useState(false), [value, setValue] = useState({ label: item.label, help_text: item.help_text || '', section: item.section });
  useEffect(() => setValue({ label: item.label, help_text: item.help_text || '', section: item.section }), [item]);
  if (editing) return <li className="space-y-2 border-t border-slate-800 py-3">
    <div className="grid gap-2 md:grid-cols-[1fr_14rem]"><input value={value.label} onChange={(e) => setValue({ ...value, label: e.target.value })} className={css} placeholder="Paso" /><input value={value.section} onChange={(e) => setValue({ ...value, section: e.target.value })} className={css} placeholder="Sección" /></div>
    <input value={value.help_text} onChange={(e) => setValue({ ...value, help_text: e.target.value })} className={css} placeholder="Ayuda opcional (aparece en el imprimible)" />
    <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300">Cancelar</button><button type="button" disabled={busy || !value.label.trim() || !value.section.trim()} onClick={async () => { if (await onSave(item, value)) setEditing(false); }} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50">Guardar</button></div>
  </li>;
  return <li className={`flex items-start gap-3 border-t border-slate-800 py-2.5 ${item.is_active ? '' : 'opacity-60'}`}>
    {item.is_active && <div className="flex shrink-0 flex-col"><button type="button" aria-label="Subir" disabled={busy || first} onClick={() => onMove(item, -1)} className="px-1 text-xs text-slate-400 disabled:opacity-20">▲</button><button type="button" aria-label="Bajar" disabled={busy || last} onClick={() => onMove(item, 1)} className="px-1 text-xs text-slate-400 disabled:opacity-20">▼</button></div>}
    <div className="min-w-0 flex-1"><p className={`text-sm ${item.is_active ? 'text-slate-100' : 'text-slate-400 line-through'}`}>{item.label}</p>{item.help_text && <p className="text-xs text-slate-500">{item.help_text}</p>}</div>
    <div className="flex shrink-0 gap-3 text-xs">{item.is_active && <button type="button" onClick={() => setEditing(true)} className="text-sky-300">Editar</button>}<button type="button" disabled={busy} onClick={() => onToggle(item)} className={item.is_active ? 'text-red-300' : 'text-emerald-300'}>{item.is_active ? 'Quitar' : 'Restaurar'}</button></div>
  </li>;
}

export function SetupChecklistPage() {
  const admin = String(profile().role || '').toLowerCase() === 'administrator';
  const [items, setItems] = useState([]), [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [draft, setDraft] = useState({ section: '', newSection: '', label: '', help_text: '' }), [showRemoved, setShowRemoved] = useState(false);

  async function refresh() {
    const [i, c] = await Promise.all([apiFetch(`${BASE}/items?all=1`), apiFetch(`${BASE}/checklists`)]);
    setItems(i.data || []); setChecklists(c.data || []);
  }
  useEffect(() => { refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  const active = items.filter((item) => item.is_active), removed = items.filter((item) => !item.is_active);
  const sections = useMemo(() => {
    const result = [];
    for (const item of active) { let s = result.find((x) => x.name === item.section); if (!s) { s = { name: item.section, items: [] }; result.push(s); } s.items.push(item); }
    return result;
  }, [items]);
  async function run(action, ok) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await refresh(); if (ok) setMessage(ok); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  const save = (item, value) => run(() => apiFetch(`${BASE}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify(value) }), 'Paso actualizado.');
  const toggle = (item) => {
    if (item.is_active && !window.confirm(`¿Quitar "${item.label}" de la plantilla? Los checklists ya iniciados lo conservan.`)) return;
    run(() => apiFetch(`${BASE}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !item.is_active }) }), item.is_active ? 'Paso quitado de la plantilla.' : 'Paso restaurado.');
  };
  const move = (item, direction) => {
    const ids = active.map((x) => x.id); const index = ids.indexOf(item.id); const target = index + direction;
    if (target < 0 || target >= ids.length || active[target].section !== item.section) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    run(() => apiFetch(`${BASE}/items/order`, { method: 'PUT', body: JSON.stringify({ ids }) }));
  };
  const add = (event) => {
    event.preventDefault();
    const section = draft.section === '__new' ? draft.newSection : draft.section;
    run(async () => { await apiFetch(`${BASE}/items`, { method: 'POST', body: JSON.stringify({ section, label: draft.label, help_text: draft.help_text }) }); setDraft({ ...draft, label: '', help_text: '' }); }, 'Paso agregado a la plantilla.');
  };
  const printBlank = () => { try { openSetupChecklistPrint({ steps: active }); } catch (e) { setError(e.message); } };
  const open = checklists.filter((c) => c.status === 'open'), recent = checklists.filter((c) => c.status !== 'open');

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-400">Preparación</p><h1 className="mt-1 text-2xl font-bold">Checklist de equipos</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Pasos para dejar listo un equipo antes de entregarlo. El checklist de cada equipo se lleva desde su ficha (pestaña Preparación) y queda registrado quién hizo cada paso y cuándo.</p></div><button type="button" onClick={printBlank} disabled={!active.length} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Imprimir en blanco</button></div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}{message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">{message}</div>}

    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="font-semibold">Equipos en preparación <span className="text-sm font-normal text-slate-500">({open.length})</span></h2>
      {loading ? <p className="mt-3 text-sm text-slate-500">Cargando…</p> : !checklists.length ? <p className="mt-3 text-sm text-slate-500">Todavía no hay checklists. Abre un activo, ve a la pestaña Preparación y presiona "Iniciar checklist".</p>
        : <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead className="text-left text-slate-400"><tr><th className="py-2 pr-4">Equipo</th><th className="py-2 pr-4">Usuario</th><th className="py-2 pr-4">Avance</th><th className="py-2 pr-4">Estado</th><th className="py-2">Última actividad</th></tr></thead><tbody>{[...open, ...recent].map((c) => <tr key={c.id} className="border-t border-slate-800">
          <td className="py-2 pr-4"><Link to={`/${c.asset_id}?tab=preparacion`} className="font-medium text-sky-300">{c.center_code || 'Sin código'}</Link><small className="block text-slate-500">{c.descripcion}</small></td>
          <td className="py-2 pr-4">{c.usuario_asignado || <span className="text-slate-500">—</span>}</td>
          <td className="py-2 pr-4"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-sky-500" style={{ width: `${c.percent}%` }} /></div><span className="text-xs text-slate-400">{c.percent}%</span></div>{c.pending > 0 && <small className="text-slate-500">faltan {c.pending}</small>}</td>
          <td className="py-2 pr-4">{c.status === 'open' ? <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300">En proceso</span> : <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300">Cerrado {dateTime(c.completed_at)}</span>}</td>
          <td className="py-2 text-xs text-slate-400">{dateTime(c.updated_at)}</td>
        </tr>)}</tbody></table><p className="mt-2 text-xs text-slate-500">Se muestran los abiertos y los cerrados en los últimos 60 días. El historial completo está en la ficha de cada equipo.</p></div>}
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">Plantilla <span className="text-sm font-normal text-slate-500">({active.length} pasos)</span></h2><p className="text-xs text-slate-500">Los cambios aplican a los checklists que se inicien después; los ya iniciados conservan sus pasos.</p></div>
      {!admin && <p className="mt-2 text-sm text-slate-500">Solo administradores pueden modificar la plantilla.</p>}
      <div className="mt-4 space-y-5">{sections.map((section) => <div key={section.name}><h3 className="mb-1 text-sm font-semibold text-sky-300">{section.name}</h3><ul>{section.items.map((item, index) => admin
        ? <ItemRow key={item.id} item={item} busy={busy} first={index === 0} last={index === section.items.length - 1} onMove={move} onSave={save} onToggle={toggle} />
        : <li key={item.id} className="border-t border-slate-800 py-2 text-sm">{item.label}</li>)}</ul></div>)}</div>
      {admin && <form onSubmit={add} className="mt-6 space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-medium">Agregar paso</p>
        <div className="grid gap-2 md:grid-cols-[14rem_1fr]">
          <select required value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} className={css}><option value="">Sección…</option>{sections.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}<option value="__new">+ Nueva sección</option></select>
          <input required value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={255} placeholder="Ej. Instalar AutoCAD" className={css} />
        </div>
        {draft.section === '__new' && <input required value={draft.newSection} onChange={(e) => setDraft({ ...draft, newSection: e.target.value })} maxLength={80} placeholder="Nombre de la nueva sección" className={css} />}
        <input value={draft.help_text} onChange={(e) => setDraft({ ...draft, help_text: e.target.value })} maxLength={500} placeholder="Ayuda opcional (aparece en el imprimible)" className={css} />
        <div className="flex justify-end"><button disabled={busy} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Agregar</button></div>
      </form>}
      {admin && removed.length > 0 && <div className="mt-5"><button type="button" onClick={() => setShowRemoved(!showRemoved)} className="text-sm text-slate-400">{showRemoved ? '▾' : '▸'} Pasos quitados ({removed.length})</button>{showRemoved && <ul className="mt-2">{removed.map((item) => <ItemRow key={item.id} item={item} busy={busy} first last onMove={move} onSave={save} onToggle={toggle} />)}</ul>}</div>}
    </section>
  </div>;
}

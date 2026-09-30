import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { openSetupChecklistPrint } from '../setupChecklistPrint.js';

const BASE = '/activos-suite/setup-checklist';
// Vive dentro del <form> de la ficha del activo: sin <form> anidado ni
// botones submit, y Enter no debe guardar el activo por accidente.
const noSubmitOnEnter = (event) => { if (event.key === 'Enter') event.preventDefault(); };
const dateTime = (value) => value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '';

function sections(entries) {
  const result = [];
  for (const entry of entries) {
    let section = result.find((item) => item.name === entry.section);
    if (!section) { section = { name: entry.section, entries: [] }; result.push(section); }
    section.entries.push(entry);
  }
  return result;
}

function ProgressBar({ progress }) {
  return <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress.percent}%` }} /></div><span className="whitespace-nowrap text-xs text-slate-400">{progress.done + progress.na} de {progress.total} · {progress.percent}%</span></div>;
}

function EntryRow({ entry, disabled, onChange }) {
  const [note, setNote] = useState(entry.note || ''), [editingNote, setEditingNote] = useState(false);
  useEffect(() => setNote(entry.note || ''), [entry.note]);
  const statusButton = (status, label, activeCss) => <button type="button" disabled={disabled} onClick={() => onChange(entry, { status: entry.status === status ? 'pending' : status })}
    className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${entry.status === status ? activeCss : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>{label}</button>;
  return <li className="flex flex-col gap-2 border-t border-slate-800 py-2.5 sm:flex-row sm:items-start">
    <div className="flex shrink-0 gap-1">{statusButton('done', '✓ Hecho', 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300')}{statusButton('na', 'No aplica', 'border-slate-500 bg-slate-700/40 text-slate-200')}</div>
    <div className="min-w-0 flex-1">
      <p className={`text-sm ${entry.status === 'pending' ? 'text-slate-100' : 'text-slate-400'} ${entry.status === 'na' ? 'line-through' : ''}`}>{entry.label}</p>
      {entry.done_at && <p className="text-[11px] text-slate-500">{entry.status === 'na' ? 'Marcado no aplica' : 'Hecho'} por {entry.done_by_name || '—'} · {dateTime(entry.done_at)}</p>}
      {editingNote ? <div className="mt-1 flex gap-2"><input autoFocus value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={noSubmitOnEnter} maxLength={500} placeholder="Nota del paso" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs" /><button type="button" onClick={async () => { await onChange(entry, { note }); setEditingNote(false); }} className="text-xs text-sky-300">Guardar</button><button type="button" onClick={() => { setNote(entry.note || ''); setEditingNote(false); }} className="text-xs text-slate-400">Cancelar</button></div>
        : entry.note ? <p className="mt-0.5 text-xs text-amber-200/80">Nota: {entry.note} {!disabled && <button type="button" onClick={() => setEditingNote(true)} className="text-sky-300">editar</button>}</p>
        : !disabled && <button type="button" onClick={() => setEditingNote(true)} className="text-[11px] text-slate-500 hover:text-sky-300">+ nota</button>}
    </div>
  </li>;
}

export function SetupChecklistPanel({ mode, asset }) {
  const [checklists, setChecklists] = useState([]), [loading, setLoading] = useState(mode === 'edit');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [extra, setExtra] = useState(''), [notes, setNotes] = useState(''), [showHistory, setShowHistory] = useState(false);
  const assetUid = asset?.asset_uid;
  const current = checklists.find((item) => item.status === 'open') || null;
  const history = checklists.filter((item) => item !== current);

  async function load() {
    const response = await apiFetch(`${BASE}/assets/${encodeURIComponent(assetUid)}`);
    setChecklists(response.data || []);
  }
  useEffect(() => { if (mode === 'edit' && assetUid) load().catch((err) => setError(err.message)).finally(() => setLoading(false)); }, [mode, assetUid]);
  useEffect(() => { setNotes(current?.notes || ''); }, [current?.id, current?.notes]);

  const replace = (updated) => setChecklists((list) => list.map((item) => item.id === updated.id ? updated : item));
  async function run(action, successMessage) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); if (successMessage) setMessage(successMessage); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const start = () => run(async () => { const r = await apiFetch(`${BASE}/assets/${encodeURIComponent(assetUid)}`, { method: 'POST' }); setChecklists((list) => [r.data, ...list]); }, 'Checklist iniciado.');
  const changeEntry = (entry, body) => run(async () => { const r = await apiFetch(`${BASE}/checklists/${current.id}/entries/${entry.id}`, { method: 'PATCH', body: JSON.stringify(body) }); replace(r.data); });
  const addExtra = () => run(async () => { const r = await apiFetch(`${BASE}/checklists/${current.id}/entries`, { method: 'POST', body: JSON.stringify({ label: extra }) }); replace(r.data); setExtra(''); }, 'Paso agregado solo a este equipo.');
  const saveNotes = () => run(async () => { const r = await apiFetch(`${BASE}/checklists/${current.id}`, { method: 'PATCH', body: JSON.stringify({ notes }) }); replace(r.data); }, 'Observaciones guardadas.');
  const complete = () => run(async () => { const r = await apiFetch(`${BASE}/checklists/${current.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', notes }) }); replace(r.data); }, 'Checklist cerrado. Queda en el historial del equipo.');
  const reopen = (checklist) => { if (window.confirm('¿Reabrir este checklist para corregirlo?')) run(async () => { const r = await apiFetch(`${BASE}/checklists/${checklist.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'open' }) }); replace(r.data); }, 'Checklist reabierto.'); };
  async function print(checklist) {
    setError('');
    try {
      if (checklist) return openSetupChecklistPrint({ steps: checklist.entries, asset, checklist });
      const r = await apiFetch(`${BASE}/items`);
      openSetupChecklistPrint({ steps: r.data || [], asset });
    } catch (err) { setError(err.message); }
  }

  const header = <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Checklist de preparación</h2><Link to="/checklist-equipos" className="text-xs text-sky-400 hover:underline">Editar plantilla y ver equipos en preparación →</Link></div>;
  if (mode === 'create') return <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">{header}<p className="mt-4 text-sm text-slate-400">Guarda primero el activo y después inicia aquí su checklist de preparación.</p></section>;

  return <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
    {header}
    {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
    {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
    {loading ? <p className="mt-4 text-sm text-slate-500">Cargando checklist…</p>
      : !current ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">{history.length ? 'No hay un checklist abierto. Puedes iniciar otro si el equipo se vuelve a preparar.' : 'Este equipo todavía no tiene checklist de preparación.'}</p>
          <div className="flex gap-2"><button type="button" onClick={() => print(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Imprimir en blanco</button><button type="button" onClick={start} disabled={busy} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Iniciar checklist</button></div>
        </div>
      : <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Iniciado por {current.started_by_name || '—'} · {dateTime(current.created_at)}</p><button type="button" onClick={() => print(current)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Imprimir para marcar a mano</button></div>
          <ProgressBar progress={current.progress} />
          {sections(current.entries).map((section) => <div key={section.name}><h3 className="mb-1 text-sm font-semibold text-sky-300">{section.name}</h3><ul>{section.entries.map((entry) => <EntryRow key={entry.id} entry={entry} disabled={busy} onChange={changeEntry} />)}</ul></div>)}
          <div className="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row"><input value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={noSubmitOnEnter} maxLength={255} placeholder="Agregar un paso solo para este equipo" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><button type="button" onClick={addExtra} disabled={busy || !extra.trim()} className="rounded-lg border border-sky-500/40 px-4 py-2 text-sm text-sky-300 disabled:opacity-50">Agregar paso</button></div>
          <label className="block text-xs text-slate-400">Observaciones<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
          <div className="flex flex-wrap justify-end gap-2">{notes !== (current.notes || '') && <button type="button" onClick={saveNotes} disabled={busy} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-50">Guardar observaciones</button>}<button type="button" onClick={complete} disabled={busy || current.progress.pending > 0} title={current.progress.pending ? `Faltan ${current.progress.pending} paso(s)` : undefined} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{current.progress.pending ? `Faltan ${current.progress.pending} paso(s)` : 'Cerrar checklist'}</button></div>
        </div>}
    {!loading && history.length > 0 && <div className="mt-5 border-t border-slate-800 pt-4">
      <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-sm font-medium text-slate-300">{showHistory ? '▾' : '▸'} Historial ({history.length})</button>
      {showHistory && <ul className="mt-3 space-y-2">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
        <div><p className="text-slate-200">Cerrado {dateTime(item.completed_at)} por {item.completed_by_name || '—'}</p><p className="text-xs text-slate-500">Iniciado {dateTime(item.created_at)} por {item.started_by_name || '—'} · {item.progress.done} hechos, {item.progress.na} no aplica</p></div>
        <div className="flex gap-3"><button type="button" onClick={() => print(item)} className="text-xs text-sky-300">Imprimir</button>{!current && <button type="button" onClick={() => reopen(item)} className="text-xs text-slate-400">Reabrir</button>}</div>
      </li>)}</ul>}
    </div>}
  </section>;
}

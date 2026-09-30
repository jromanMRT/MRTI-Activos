import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { copy, formatTeamviewerId } from '../pages/TeamViewerPage.jsx';

const css = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
// Este panel vive dentro del <form> de la ficha del activo: nada de <form>
// anidado ni botones submit, y Enter no debe guardar el activo por accidente.
const noSubmitOnEnter = (event) => { if (event.key === 'Enter') event.preventDefault(); };

export function TeamViewerAssetPanel({ mode, assetUid, isAdministrator }) {
  const [record, setRecord] = useState(null), [loading, setLoading] = useState(mode === 'edit');
  const [editing, setEditing] = useState(false), [value, setValue] = useState({ teamviewer_id: '', alias: '', password: '', notes: '' });
  const [password, setPassword] = useState(null), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');

  async function load() {
    const response = await apiFetch(`/activos-suite/teamviewer?asset_uid=${encodeURIComponent(assetUid)}`);
    setRecord(response.data?.[0] || null);
  }
  useEffect(() => {
    if (mode !== 'edit' || !assetUid) return;
    load().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [mode, assetUid]);

  function startEdit() {
    setError(''); setMessage(''); setPassword(null);
    setValue({ teamviewer_id: record?.teamviewer_id || '', alias: record?.alias || '', password: '', notes: record?.notes || '' });
    setEditing(true);
  }
  async function save() {
    setSaving(true); setError('');
    try {
      const body = { ...value, asset_uid: assetUid };
      if (record && !body.password) delete body.password;
      await apiFetch(record ? `/activos-suite/teamviewer/${record.id}` : '/activos-suite/teamviewer', { method: record ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      await load(); setEditing(false); setMessage(record ? 'TeamViewer actualizado.' : 'TeamViewer registrado.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function reveal() {
    setError('');
    try { const response = await apiFetch(`/activos-suite/teamviewer/${record.id}/secret`); setPassword(response.data.password || ''); }
    catch (err) { setError(err.message); }
  }
  const change = (key) => (event) => setValue((current) => ({ ...current, [key]: event.target.value }));

  return <section className="mb-7 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">TeamViewer</h2><Link to="/seguridad-acceso?tab=teamviewer" className="text-xs text-sky-400 hover:underline">Ver todos los TeamViewer →</Link></div>
    {error && <p className="mt-4 text-sm text-red-300">{error}</p>}{message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}
    {mode === 'create' ? <p className="mt-4 text-sm text-slate-400">Guarda primero el activo y después registra aquí su TeamViewer.</p>
      : loading ? <p className="mt-4 text-sm text-slate-500">Consultando TeamViewer…</p>
      : editing ? <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-slate-400">ID de TeamViewer *<input inputMode="numeric" value={value.teamviewer_id} onChange={change('teamviewer_id')} onKeyDown={noSubmitOnEnter} placeholder="Ej. 1 234 567 890" className={css} /></label>
          <label className="text-xs text-slate-400">Nombre para identificarlo<input value={value.alias} onChange={change('alias')} onKeyDown={noSubmitOnEnter} className={css} /></label>
          <label className="text-xs text-slate-400 md:col-span-2">Contraseña{record?.has_password ? ' (déjala vacía para no cambiarla)' : ''}<input type="password" autoComplete="new-password" value={value.password} onChange={change('password')} onKeyDown={noSubmitOnEnter} placeholder={record?.has_password ? '••••••••' : ''} className={css} /><span className="mt-1 block text-[11px] text-slate-500">Se guarda cifrada; solo administradores pueden verla.</span></label>
          <label className="text-xs text-slate-400 md:col-span-2">Notas<input value={value.notes} onChange={change('notes')} onKeyDown={noSubmitOnEnter} className={css} /></label>
          <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-50">Cancelar</button><button type="button" onClick={save} disabled={saving || !value.teamviewer_id.trim()} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar TeamViewer'}</button></div>
        </div>
      : record ? <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2"><strong className="font-mono text-slate-100">{formatTeamviewerId(record.teamviewer_id)}</strong><button type="button" onClick={() => copy(record.teamviewer_id, setMessage)} className="text-xs text-sky-300">Copiar ID</button></p>
            {record.alias && <p className="mt-1 text-xs text-slate-500">{record.alias}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">{!record.has_password ? <span className="text-slate-500">Sin contraseña guardada</span>
              : !isAdministrator ? <span className="text-slate-500">Contraseña guardada (solo administradores)</span>
              : password === null ? <><code className="rounded bg-slate-900 px-2 py-1 text-xs">••••••••</code><button type="button" onClick={reveal} className="text-xs text-sky-300">Ver contraseña</button></>
              : <><code className="rounded bg-slate-900 px-2 py-1 text-xs">{password}</code><button type="button" onClick={() => copy(password, setMessage)} className="text-xs text-sky-300">Copiar</button><button type="button" onClick={() => setPassword(null)} className="text-xs text-slate-400">Ocultar</button></>}</p>
          </div>
          {isAdministrator && <button type="button" onClick={startEdit} className="rounded-lg border border-sky-500/40 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/10">Editar TeamViewer</button>}
        </div>
      : <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-amber-300">Este equipo no tiene TeamViewer registrado.</p>{isAdministrator && <button type="button" onClick={startEdit} className="rounded-lg border border-sky-500/40 px-4 py-2 text-sm text-sky-300 hover:bg-sky-500/10">Agregar TeamViewer</button>}</div>}
  </section>;
}

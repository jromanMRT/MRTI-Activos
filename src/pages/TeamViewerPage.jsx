import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';

const EMPTY = { teamviewer_id: '', alias: '', password: '', asset_uid: '', notes: '' };
const profile = () => { try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; } };
const css = 'mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-ore-500';
// Mismo formato con el que TeamViewer muestra el ID: grupos de tres desde la derecha.
export const formatTeamviewerId = (value) => String(value || '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const assetLabel = (a) => `${a.center_code || 'Sin código'} · ${a.usuario_asignado || a.descripcion || 'Sin asignar'}${a.estado && a.estado !== 'Activo' ? ` (${a.estado})` : ''}`;

export async function copy(text, setMessage) {
  try { await navigator.clipboard.writeText(text); setMessage('Copiado al portapapeles.'); } catch { setMessage('No se pudo copiar; selecciónalo manualmente.'); }
}

function Dialog({ eyebrow, title, onClose, busy, children, footer, onSubmit }) {
  useEffect(() => {
    function closeOnEscape(event) { if (event.key === 'Escape' && !busy) onClose(); }
    document.addEventListener('keydown', closeOnEscape); const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [onClose, busy]);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="teamviewer-dialog-title" className="flex max-h-full w-full flex-col overflow-hidden bg-stone-900 shadow-2xl sm:max-h-[85dvh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-stone-700">
      <header className="flex items-start justify-between gap-4 border-b border-stone-700 px-5 py-4 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-widest text-ore-300">{eyebrow}</p><h2 id="teamviewer-dialog-title" className="mt-1 text-xl font-bold">{title}</h2></div><button type="button" onClick={onClose} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-stone-700 text-stone-400 hover:bg-stone-800 hover:text-stone-100 disabled:opacity-50" aria-label="Cerrar">×</button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-stone-700 bg-stone-800/50 px-5 py-4 sm:px-7">{footer}</footer>
    </form>
  </div>;
}

function DeviceDialog({ record, assets, onClose, onSaved }) {
  const editing = Boolean(record);
  const [value, setValue] = useState(() => record ? { teamviewer_id: record.teamviewer_id, alias: record.alias || '', password: '', asset_uid: record.asset_uid || '', notes: record.notes || '' } : EMPTY);
  const [assetSearch, setAssetSearch] = useState(''), [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const change = (key, next) => setValue((current) => ({ ...current, [key]: next }));
  const candidates = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    return assets.filter((a) => (!a.teamviewer_device_id || a.teamviewer_device_id === record?.id || a.asset_uid === value.asset_uid)
      && (!q || a.asset_uid === value.asset_uid || [a.center_code, a.descripcion, a.usuario_asignado, a.numero_serie].some((v) => String(v || '').toLowerCase().includes(q))));
  }, [assets, assetSearch, record, value.asset_uid]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const body = { ...value, asset_uid: value.asset_uid || null };
      if (editing && !body.password) delete body.password;
      await apiFetch(editing ? `/activos-suite/teamviewer/${record.id}` : '/activos-suite/teamviewer', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      await onSaved(editing ? 'TeamViewer actualizado.' : 'TeamViewer registrado.'); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  async function remove() {
    if (!window.confirm(`¿Eliminar el TeamViewer ${formatTeamviewerId(record.teamviewer_id)}? Se borra también su contraseña guardada.`)) return;
    setSaving(true); setError('');
    try { await apiFetch(`/activos-suite/teamviewer/${record.id}`, { method: 'DELETE' }); await onSaved('TeamViewer eliminado.'); onClose(); }
    catch (err) { setError(err.message); setSaving(false); }
  }

  return <Dialog eyebrow={editing ? 'Editar acceso' : 'Nuevo acceso'} title={editing ? `TeamViewer ${formatTeamviewerId(record.teamviewer_id)}` : 'Registrar TeamViewer'} busy={saving} onClose={onClose} onSubmit={submit}
    footer={<>{editing && <button type="button" onClick={remove} disabled={saving} className="mr-auto rounded-lg border border-mrt-bad/40 px-4 py-2 text-sm text-mrt-bad-light disabled:opacity-50">Eliminar</button>}<button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 disabled:opacity-50">Cancelar</button><button disabled={saving} className="rounded-lg bg-ore-500 px-5 py-2 text-sm font-semibold text-stone-900 disabled:opacity-50">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar'}</button></>}>
    {error && <div className="mb-4 rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 px-4 py-3 text-sm text-mrt-bad-light">{error}</div>}
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-xs text-stone-400">ID de TeamViewer *<input required inputMode="numeric" value={value.teamviewer_id} onChange={(e) => change('teamviewer_id', e.target.value)} placeholder="Ej. 1 234 567 890" className={css} /></label>
      <label className="text-xs text-stone-400">Nombre para identificarlo<input value={value.alias} onChange={(e) => change('alias', e.target.value)} placeholder="Ej. Laptop Contabilidad" className={css} /></label>
      <label className="text-xs text-stone-400 md:col-span-2">Contraseña{editing && record.has_password ? ' (déjala vacía para no cambiarla)' : ''}
        <span className="flex gap-2"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={value.password} onChange={(e) => change('password', e.target.value)} placeholder={editing && record.has_password ? '••••••••' : 'Contraseña fija de acceso desatendido'} className={css} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="mt-1 shrink-0 rounded-lg border border-stone-600 px-3 text-xs text-stone-300">{showPassword ? 'Ocultar' : 'Mostrar'}</button></span>
        <span className="mt-1 block text-[11px] text-stone-500">Se guarda cifrada. Solo administradores pueden verla y cada consulta queda en auditoría.</span></label>
      <div className="md:col-span-2"><p className="text-xs text-stone-400">Equipo vinculado</p><div className="mt-1 flex flex-col gap-2 sm:flex-row"><input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Filtrar por código, usuario o serie" className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-sm sm:w-64" /><select value={value.asset_uid} onChange={(e) => change('asset_uid', e.target.value)} className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-sm"><option value="">Sin equipo vinculado</option>{candidates.map((a) => <option key={a.asset_uid} value={a.asset_uid}>{assetLabel(a)}</option>)}</select></div><p className="mt-1 text-[11px] text-stone-500">Solo aparecen los equipos que todavía no tienen un TeamViewer.</p></div>
      <label className="text-xs text-stone-400 md:col-span-2">Notas<textarea rows={3} value={value.notes} onChange={(e) => change('notes', e.target.value)} className={css} /></label>
    </div>
  </Dialog>;
}

function PasswordCell({ record, admin, setMessage, setError }) {
  const [password, setPassword] = useState(null), [loading, setLoading] = useState(false);
  if (!record.has_password) return <span className="text-stone-500">Sin contraseña</span>;
  if (!admin) return <span className="text-stone-500">••••••••</span>;
  async function reveal() {
    setLoading(true);
    try { const r = await apiFetch(`/activos-suite/teamviewer/${record.id}/secret`); setPassword(r.data.password || ''); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <span className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
    <code className="rounded bg-stone-800 px-2 py-1 text-xs">{password ?? '••••••••'}</code>
    {password === null ? <button type="button" onClick={reveal} disabled={loading} className="text-xs text-ore-300">{loading ? '…' : 'Ver'}</button>
      : <><button type="button" onClick={() => copy(password, setMessage)} className="text-xs text-ore-300">Copiar</button><button type="button" onClick={() => setPassword(null)} className="text-xs text-stone-400">Ocultar</button></>}
  </span>;
}

export function TeamViewerPage() {
  const admin = String(profile().role || '').toLowerCase() === 'administrator';
  const [devices, setDevices] = useState([]), [assets, setAssets] = useState([]), [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null); // null | { record }
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [loading, setLoading] = useState(true);

  async function refresh() {
    const [d, a] = await Promise.all([apiFetch('/activos-suite/teamviewer'), apiFetch('/activos-suite/teamviewer/assets')]);
    setDevices(d.data || []); setAssets(a.data || []);
  }
  useEffect(() => { refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    const digits = q.replace(/\s/g, '');
    return !q ? devices : devices.filter((d) => (digits && /^\d+$/.test(digits) && d.teamviewer_id.includes(digits))
      || [d.alias, d.center_code, d.usuario_asignado, d.descripcion, d.notes].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [devices, query]);
  const activeAssets = assets.filter((a) => a.estado === 'Activo');
  const withoutTeamviewer = activeAssets.filter((a) => !a.teamviewer_device_id).length;
  const open = (record = null) => { setError(''); setMessage(''); setDialog({ record }); };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-ore-300">Acceso remoto</p><h1 className="mt-1 text-2xl font-bold">TeamViewer</h1><p className="mt-1 max-w-3xl text-sm text-stone-400">Guarda el ID y la contraseña de cada equipo y vincúlalo con su activo para saber a quién pertenece.</p></div>{admin && <Button size="sm" onClick={() => open()}>Nuevo TeamViewer</Button>}</div>
    {error && <div className="rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 px-4 py-3 text-mrt-bad-light">{error}</div>}{message && <div className="rounded-lg border border-mrt-good/30 bg-mrt-good/10 px-4 py-3 text-mrt-good-light">{message}</div>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="border-stone-700 bg-stone-800/60 p-4"><p className="text-sm text-stone-400">Registrados</p><p className="mt-2 text-3xl font-bold text-ore-300">{loading ? '…' : devices.length}</p><p className="mt-1 text-xs text-stone-500">IDs de TeamViewer</p></Card>
      <Card className="border-stone-700 bg-stone-800/60 p-4"><p className="text-sm text-stone-400">Sin equipo</p><p className="mt-2 text-3xl font-bold text-ore-300">{loading ? '…' : devices.filter((d) => !d.asset_uid).length}</p><p className="mt-1 text-xs text-stone-500">Falta vincular a un activo</p></Card>
      <Card className="border-stone-700 bg-stone-800/60 p-4"><p className="text-sm text-stone-400">Activos sin TeamViewer</p><p className="mt-2 text-3xl font-bold text-ore-300">{loading ? '…' : withoutTeamviewer}</p><p className="mt-1 text-xs text-stone-500">de {activeAssets.length} equipos activos</p></Card>
    </div>
    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por ID, equipo, usuario o nombre…" />
    <section className="overflow-hidden rounded-xl border border-stone-700">{loading ? <p className="p-5 text-stone-500">Cargando…</p> : !shown.length ? <p className="p-5 text-sm text-stone-500">{devices.length ? 'Sin resultados para esa búsqueda.' : 'Todavía no hay TeamViewer registrados.'}</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-stone-800 text-left text-stone-400"><tr><th className="px-4 py-3">ID TeamViewer</th><th className="px-4 py-3">Contraseña</th><th className="px-4 py-3">Equipo</th><th className="px-4 py-3">Asignado a</th><th className="px-4 py-3">Notas</th></tr></thead><tbody>{shown.map((d) => <tr key={d.id} onClick={() => admin && open(d)} className={`border-t border-stone-700 even:bg-stone-800/30 ${admin ? 'cursor-pointer hover:bg-stone-800/60' : ''}`}>
      <td className="px-4 py-3"><span className="flex items-center gap-2"><strong className="font-mono">{formatTeamviewerId(d.teamviewer_id)}</strong><button type="button" onClick={(e) => { e.stopPropagation(); copy(d.teamviewer_id, setMessage); }} className="text-xs text-ore-300">Copiar</button></span>{d.alias && <small className="block text-stone-500">{d.alias}</small>}</td>
      <td className="px-4 py-3"><PasswordCell record={d} admin={admin} setMessage={setMessage} setError={setError} /></td>
      <td className="px-4 py-3">{d.asset_uid ? <><Link to={`/${d.asset_id}?tab=antivirus`} onClick={(e) => e.stopPropagation()} className="font-medium text-ore-300">{d.center_code || 'Sin código'}</Link><small className="block text-stone-500">{d.descripcion}</small></> : <span className="text-mrt-warn-light">Sin vincular</span>}</td>
      <td className="px-4 py-3">{d.usuario_asignado || <span className="text-stone-500">—</span>}</td>
      <td className="max-w-64 truncate px-4 py-3 text-stone-400">{d.notes || '—'}</td>
    </tr>)}</tbody></table></div>}</section>
    {dialog && <DeviceDialog record={dialog.record} assets={assets} onClose={() => setDialog(null)} onSaved={async (text) => { await refresh(); setMessage(text); }} />}
  </div>;
}

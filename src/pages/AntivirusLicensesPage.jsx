import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';

const EMPTY = { product_id: '', display_name: '', license_key: '', purchase_date: '', expires_on: '', seat_capacity: 5, provider: '', purchase_reference: '', notes: '' };
const profile = () => { try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; } };
const dateText = (value) => value ? String(value).slice(0, 10).split('-').reverse().join('/') : 'Sin registrar';

function Metric({ label, value, detail }) {
  return <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-sky-400">{value ?? '…'}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}

function Fields({ value, products, onChange }) {
  const css = 'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500';
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <label className="text-xs text-slate-400">Antivirus<select required value={value.product_id} onChange={(e) => onChange('product_id', e.target.value)} className={css}><option value="">Seleccionar…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.vendor} · {p.name}{p.is_default ? ' (predeterminado)' : ''}</option>)}</select></label>
    <label className="text-xs text-slate-400">Nombre para identificarla<input value={value.display_name} onChange={(e) => onChange('display_name', e.target.value)} placeholder="Ej. Oficinas 2026" className={css} /></label>
    <label className="text-xs text-slate-400">Clave de licencia<input required value={value.license_key} onChange={(e) => onChange('license_key', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Fecha de compra<input type="date" value={value.purchase_date} onChange={(e) => onChange('purchase_date', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Fecha de caducidad<input type="date" value={value.expires_on} onChange={(e) => onChange('expires_on', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Dispositivos permitidos<input required type="number" min="1" max="10000" value={value.seat_capacity} onChange={(e) => onChange('seat_capacity', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Proveedor<input value={value.provider} onChange={(e) => onChange('provider', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Factura / referencia<input value={value.purchase_reference} onChange={(e) => onChange('purchase_reference', e.target.value)} className={css} /></label>
    <label className="text-xs text-slate-400">Notas<input value={value.notes} onChange={(e) => onChange('notes', e.target.value)} className={css} /></label>
  </div>;
}

function badge(license) {
  if (license.legacy || license.migration_status === 'needs_review') return ['Revisar migración', 'bg-amber-500/15 text-amber-300'];
  if (Number(license.dias_restantes) < 0) return ['Vencida', 'bg-red-500/15 text-red-300'];
  if (license.fecha_vence && Number(license.dias_restantes) <= 30) return ['Por vencer', 'bg-amber-500/15 text-amber-300'];
  return license.fecha_vence ? ['Vigente', 'bg-emerald-500/15 text-emerald-300'] : ['Sin caducidad', 'bg-slate-800 text-slate-400'];
}

export function AntivirusLicensesPage() {
  const admin = String(profile().role || '').toLowerCase() === 'administrator';
  const [licenses, setLicenses] = useState([]), [products, setProducts] = useState([]), [assets, setAssets] = useState([]);
  const [meta, setMeta] = useState({}), [query, setQuery] = useState(''), [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false), [form, setForm] = useState(EMPTY), [edit, setEdit] = useState(null);
  const [assetSearch, setAssetSearch] = useState(''), [assetUid, setAssetUid] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);

  async function refresh() {
    const [l, p, a] = await Promise.all([apiFetch('/activos-suite/antivirus-licenses'), apiFetch('/activos-suite/antivirus-licenses/products'), apiFetch('/activos-suite/antivirus-licenses/assets')]);
    setLicenses(l.data || []); setMeta(l.meta || {}); setProducts(p.data || []); setAssets(a.data || []);
    const defaultProduct = (p.data || []).find((item) => item.is_default) || p.data?.[0];
    setForm((current) => ({ ...current, product_id: current.product_id || String(defaultProduct?.id || '') }));
  }
  useEffect(() => { refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);

  const selected = licenses.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!selected || selected.legacy) return setEdit(null);
    setEdit({ product_id: String(selected.product_id), display_name: selected.display_name || '', license_key: selected.license_key || '', purchase_date: selected.fecha_adquisicion || '', expires_on: selected.fecha_vence || '', seat_capacity: selected.capacity, provider: selected.provider || '', purchase_reference: selected.purchase_reference || '', notes: selected.notes || '' });
  }, [selectedId, licenses]);
  const shown = useMemo(() => { const q = query.trim().toLowerCase(); return !q ? licenses : licenses.filter((l) => [l.display_name, l.license_key, l.product_name, l.vendor, l.center_codes].some((v) => String(v || '').toLowerCase().includes(q))); }, [licenses, query]);
  const candidates = useMemo(() => { const q = assetSearch.trim().toLowerCase(); return assets.filter((a) => !a.license_id && (!q || [a.center_code, a.descripcion, a.usuario_asignado].some((v) => String(v || '').toLowerCase().includes(q)))).slice(0, 100); }, [assets, assetSearch]);
  const change = (setter) => (key, value) => setter((current) => ({ ...current, [key]: value }));
  const feedback = () => { setError(''); setMessage(''); };

  async function create(event) {
    event.preventDefault(); setSaving(true); feedback();
    try { const r = await apiFetch('/activos-suite/antivirus-licenses', { method: 'POST', body: JSON.stringify(form) }); setCreating(false); setForm({ ...EMPTY, product_id: form.product_id }); setSelectedId(r.data.id); setMessage('Licencia creada. Ya puedes vincular sus activos.'); await refresh(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function update(event) {
    event.preventDefault(); setSaving(true); feedback();
    try { await apiFetch(`/activos-suite/antivirus-licenses/${selected.id}`, { method: 'PATCH', body: JSON.stringify(edit) }); setMessage('Licencia actualizada.'); await refresh(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function assign() {
    if (!assetUid) return; setSaving(true); feedback();
    try { await apiFetch(`/activos-suite/antivirus-licenses/${selected.id}/assets`, { method: 'POST', body: JSON.stringify({ asset_uid: assetUid }) }); setAssetUid(''); setAssetSearch(''); setMessage('Activo vinculado.'); await refresh(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  async function unassign(asset) {
    if (!window.confirm(`¿Desvincular ${asset.center_code || 'este activo'}?`)) return; setSaving(true); feedback();
    try { await apiFetch(`/activos-suite/antivirus-licenses/${selected.id}/assets/${asset.asset_uid}`, { method: 'DELETE' }); setMessage('Activo desvinculado.'); await refresh(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-400">Licenciamiento</p><h1 className="mt-1 text-2xl font-bold">Licencias antivirus</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Registra cada compra una vez, define su capacidad y vincula los equipos. ESET queda seleccionado por defecto.</p></div><div className="flex gap-2"><Link to="/alertas?tipo=antivirus" className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-300">Ver vencimientos</Link>{admin && <button onClick={() => setCreating(!creating)} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950">{creating ? 'Cancelar' : 'Nueva licencia'}</button>}</div></div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}{message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">{message}</div>}
    {creating && <form onSubmit={create} className="rounded-xl border border-sky-500/30 bg-slate-900/60 p-5"><h2 className="mb-4 font-semibold">Registrar licencia</h2><Fields value={form} products={products} onChange={change(setForm)} /><div className="mt-4 flex justify-end"><button disabled={saving} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950">Crear licencia</button></div></form>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Licencias" value={meta.licenses} detail="Compras registradas" /><Metric label="Capacidad" value={meta.capacity} detail="Dispositivos permitidos" /><Metric label="En uso" value={meta.devices} detail="Activos vinculados" /><Metric label="Disponibles" value={meta.available_seats} detail="Lugares libres" /><Metric label="Por revisar" value={meta.conflicts} detail={`${meta.expired || 0} vencidas`} /></div>
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar licencia, antivirus o equipo…" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm" />
    <section className="overflow-hidden rounded-xl border border-slate-800">{loading ? <p className="p-5 text-slate-500">Cargando…</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr><th className="px-4 py-3">Licencia</th><th className="px-4 py-3">Antivirus</th><th className="px-4 py-3">Uso</th><th className="px-4 py-3">Compra</th><th className="px-4 py-3">Caducidad</th><th className="px-4 py-3">Estado</th></tr></thead><tbody>{shown.map((l) => { const [label, css] = badge(l); return <tr key={l.group_key} onClick={() => setSelectedId(l.id)} className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/60"><td className="max-w-72 px-4 py-3"><strong className="block">{l.display_name || l.license_key || 'Registro sin clave'}</strong>{l.display_name && <small className="break-all text-slate-500">{l.license_key}</small>}</td><td className="px-4 py-3">{l.product_name || 'Sin definir'}<small className="block text-slate-500">{l.vendor}</small></td><td className="px-4 py-3">{l.device_count} / {l.capacity}<small className="block text-slate-500">{l.available_seats} libres</small></td><td className="px-4 py-3">{dateText(l.fecha_adquisicion)}</td><td className="px-4 py-3">{dateText(l.fecha_vence)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${css}`}>{label}</span></td></tr>; })}</tbody></table></div>}</section>
    {selected && <section className="rounded-xl border border-sky-500/25 bg-slate-900/50 p-5"><div className="mb-5 flex justify-between"><div><p className="text-xs uppercase tracking-wider text-sky-400">Detalle</p><h2 className="mt-1 text-lg font-semibold">{selected.display_name || selected.license_key || 'Registro histórico'}</h2></div><button onClick={() => setSelectedId(null)} className="text-slate-400">Cerrar</button></div>{selected.legacy ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">Este registro antiguo no tenía clave. Crea la licencia correcta y vincula el activo desde ella.</p> : <>{admin && edit && <form onSubmit={update}><Fields value={edit} products={products} onChange={change(setEdit)} /><div className="mt-4 flex justify-end"><button disabled={saving} className="rounded-lg border border-sky-500/50 px-4 py-2 text-sm text-sky-300">Guardar cambios</button></div></form>}<div className="mt-6 border-t border-slate-800 pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">Activos vinculados</h3><p className="text-xs text-slate-500">{selected.device_count} de {selected.capacity} lugares.</p></div>{admin && selected.available_seats > 0 && <div className="flex flex-wrap gap-2"><input value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Filtrar activos" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><select value={assetUid} onChange={(e) => setAssetUid(e.target.value)} className="max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">Seleccionar activo…</option>{candidates.map((a) => <option key={a.asset_uid} value={a.asset_uid}>{a.center_code || 'Sin código'} · {a.usuario_asignado || a.descripcion || 'Sin asignar'}</option>)}</select><button onClick={assign} type="button" disabled={!assetUid || saving} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Vincular</button></div>}</div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selected.devices.length ? selected.devices.map((a) => <article key={a.asset_uid} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div className="flex justify-between gap-3"><div><Link to={`/${a.id}?tab=antivirus`} className="font-medium text-sky-300">{a.center_code || 'Sin código'}</Link><p className="text-xs text-slate-400">{a.usuario_asignado || a.descripcion || 'Sin asignar'}</p></div>{admin && <button onClick={() => unassign(a)} className="text-xs text-red-300">Desvincular</button>}</div></article>) : <p className="text-sm text-slate-500">Sin activos vinculados.</p>}</div></div></>}</section>}
    {!admin && <p className="text-xs text-slate-500">Un administrador debe registrar licencias o cambiar vínculos.</p>}
  </div>;
}

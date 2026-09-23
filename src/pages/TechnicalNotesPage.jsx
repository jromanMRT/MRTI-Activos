import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api.js';

const EMPTY_NOTE = { title: '', equipment_reference: '', serial_reference: '', replacement_reference: '', purchase_url: '', content: '', asset_uid: '' };
const INPUT = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const BUTTON = 'rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50';
const PRIMARY = 'rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50';

export function TechnicalNotesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const assetUid = searchParams.get('asset_uid') || '';
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, page: String(page), archived: archived ? '1' : '0' });
      if (assetUid) params.set('asset_uid', assetUid);
      apiFetch(`/technical-notes?${params}`).then((body) => { if (current) setResult(body); })
        .catch((err) => { if (current) setError(err.message); })
        .finally(() => { if (current) setLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query, archived, page, refresh, assetUid]);

  async function archive(note) {
    const next = !note.archived_at;
    if (next && !window.confirm(`¿Archivar “${note.title}”? Podrás recuperarla en Archivadas.`)) return;
    setBusyId(note.id); setError(''); setNotice('');
    try {
      await apiFetch(`/technical-notes/${note.id}/archive`, { method: 'PATCH', body: JSON.stringify({ revision: note.revision, archived: next }) });
      setNotice(next ? 'Referencia archivada. Puedes restaurarla desde Archivadas.' : 'Referencia restaurada.');
      setPage(1); setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-5">
    <section className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Referencias técnicas</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Guarda baterías compatibles, números de parte y referencias de compra. Encuentra cada referencia por equipo, serie, repuesto o contenido.</p></div>
      {!editor && <button type="button" className={PRIMARY} onClick={() => { setEditor({ ...EMPTY_NOTE, asset_uid: assetUid }); setNotice(''); }}>+ Nueva referencia</button>}
    </section>
    <p className="text-sm text-slate-400">¿Buscas un procedimiento o la solución a una falla? Consulta la <a href="/tickets/knowledge-base" className="text-sky-400 underline">base de conocimientos de Tickets</a>.</p>
    {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{notice}</p>}
    {editor && <NoteEditor key={editor.id || 'new'} note={editor} onCancel={() => setEditor(null)} onSaved={() => {
      setEditor(null); setNotice('Referencia guardada correctamente.'); setQuery(''); setArchived(false); setPage(1); setRefresh((value) => value + 1);
    }} />}
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <label className="min-w-0 flex-1 text-sm text-slate-300">Buscar referencias<input type="search" maxLength={300} className={`${INPUT} mt-1`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Ej. batería Dell, TI-00274, serie o número de parte" /></label>
      <div><label htmlFor="technical-note-status" className="text-sm text-slate-300">Mostrar</label><select id="technical-note-status" className={`${INPUT} mt-1`} value={archived ? 'archived' : 'active'} onChange={(event) => { setArchived(event.target.value === 'archived'); setPage(1); }}><option value="active">Vigentes</option><option value="archived">Archivadas</option></select></div>
      {assetUid && <button type="button" className={BUTTON} onClick={() => { setSearchParams({}); setPage(1); }}>Quitar filtro de equipo</button>}
    </section>
    {error && <p role="alert" className="text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></p>}
    {loading ? <p role="status" className="py-8 text-center text-slate-400">Buscando referencias…</p> : !error && <>
      <p className="text-sm text-slate-400">{result.total} {result.total === 1 ? 'referencia' : 'referencias'}{assetUid ? ' del equipo seleccionado' : ''}</p>
      {!result.data.length && <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center"><h2 className="font-semibold">{query ? 'No hay referencias que coincidan' : archived ? 'No hay referencias archivadas' : 'Tus referencias técnicas, en un solo lugar'}</h2><p className="mt-2 text-sm text-slate-400">{query ? 'Prueba con una parte del modelo, serie o número de parte.' : 'Por ejemplo: el modelo de batería de una laptop, su voltaje, conector y dónde conseguirla.'}</p></div>}
      <div className="grid gap-4 xl:grid-cols-2">
        {result.data.map((note) => <article key={note.id} className="min-w-0 space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div><h2 className="break-words text-lg font-semibold">{note.title}</h2>{note.asset_id && <Link className="mt-1 inline-block text-sm text-sky-400 underline" to={`/${note.asset_id}`}>{note.asset_code} · {[note.asset_brand, note.asset_model].filter(Boolean).join(' ')}</Link>}</div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <NoteDetail label="Equipo / producto" value={note.equipment_reference} />
            <NoteDetail label="Serie / identificador" value={note.serial_reference} />
            <NoteDetail label="Repuesto / número de parte" value={note.replacement_reference} />
            <NoteDetail label="Serie del equipo vinculado" value={[note.asset_serial, note.asset_service_tag].filter(Boolean).join(' · ')} />
          </dl>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{note.content}</p>
          {note.purchase_url && <a href={note.purchase_url} target="_blank" rel="noopener noreferrer" className="inline-block break-all text-sm text-sky-400 underline">Ver referencia de compra ↗</a>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
            <p className="text-xs text-slate-500">{note.created_by_name || 'Usuario de Activos'} · Actualizada {new Date(note.updated_at).toLocaleDateString('es-MX')}</p>
            {note.can_edit && <div className="flex gap-2">{!note.archived_at && <button type="button" disabled={Boolean(editor) || Boolean(busyId)} className={BUTTON} onClick={() => { setEditor(note); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar</button>}<button type="button" disabled={Boolean(busyId) || Boolean(editor)} className={BUTTON} onClick={() => archive(note)}>{busyId === note.id ? 'Guardando…' : note.archived_at ? 'Restaurar' : 'Archivar'}</button></div>}
          </div>
        </article>)}
      </div>
      {result.total > 30 && <nav aria-label="Páginas de referencias" className="flex items-center justify-center gap-4"><button className={BUTTON} disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><span className="text-sm">Página {page} de {Math.ceil(result.total / 30)}</span><button className={BUTTON} disabled={page * 30 >= result.total} onClick={() => setPage((value) => value + 1)}>Siguiente</button></nav>}
    </>}
  </div>;
}

function NoteDetail({ label, value }) {
  return value ? <div className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-200">{value}</dd></div> : null;
}

function NoteEditor({ note, onCancel, onSaved }) {
  const [form, setForm] = useState(Object.fromEntries(Object.keys(EMPTY_NOTE).map((key) => [key, note[key] || ''])));
  const [selectedAsset, setSelectedAsset] = useState(note.asset_uid ? { center_code: note.asset_code, modelo: note.asset_model, numero_serie: note.asset_serial } : null);
  const [assetQuery, setAssetQuery] = useState('');
  const [assets, setAssets] = useState([]);
  const [assetError, setAssetError] = useState('');
  const [finding, setFinding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const update = (field, value) => { setDirty(true); setForm((current) => ({ ...current, [field]: value })); };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let current = true;
    setAssets([]); setAssetError('');
    if (!assetQuery.trim()) { setFinding(false); return; }
    setFinding(true);
    const timer = setTimeout(() => {
      apiFetch(`/technical-notes/assets?q=${encodeURIComponent(assetQuery)}`)
        .then((body) => { if (current) setAssets(body.data); })
        .catch((err) => { if (current) setAssetError(err.message); })
        .finally(() => { if (current) setFinding(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [assetQuery]);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiFetch(`/technical-notes${note.id ? `/${note.id}` : ''}`, { method: note.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, ...(note.id ? { revision: note.revision } : {}) }) });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  const field = (key, label, placeholder, maxLength, required = false) => <label className="block text-sm text-slate-300">{label}<input className={`${INPUT} mt-1`} type={key === 'purchase_url' ? 'url' : 'text'} autoFocus={key === 'title'} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} /></label>;
  return <form onSubmit={save} className="space-y-4 rounded-xl border border-sky-500/40 bg-slate-900 p-5" aria-label={note.id ? 'Editar referencia técnica' : 'Nueva referencia técnica'}>
    <h2 className="text-lg font-semibold">{note.id ? 'Editar referencia' : 'Nueva referencia'}</h2>
    <fieldset disabled={saving} className="space-y-4">
      {field('title', 'Título *', 'Ej. Batería compatible para Dell Pro Max Slim', 180, true)}
      <div className="grid gap-4 md:grid-cols-2">
        {field('equipment_reference', 'Equipo o producto que la utiliza', 'Marca, modelo y variantes compatibles', 500)}
        {field('serial_reference', 'Serie o identificador de referencia', 'Serie, service tag u otra identificación', 180)}
        {field('replacement_reference', 'Repuesto / número de parte a comprar', 'Modelo de batería, P/N o código del proveedor', 500)}
        {field('purchase_url', 'Enlace de compra o ficha técnica (opcional)', 'https://…', 2000)}
      </div>
      <div><label htmlFor="technical-note-content" className="block text-sm text-slate-300">Notas y especificaciones *</label><textarea id="technical-note-content" required maxLength={20000} rows={6} className={`${INPUT} mt-1`} value={form.content} onChange={(event) => update('content', event.target.value)} placeholder="Anota voltaje, capacidad, tipo de conector, medidas, compatibilidad confirmada y cualquier detalle útil antes de comprar." /></div>
      <div className="rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-semibold">Vincular a un activo (opcional)</h3>
        <p className="mt-1 text-xs text-slate-400">Puedes guardar compatibilidades para varios modelos sin elegir un equipo.</p>
        {selectedAsset ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{selectedAsset.center_code || 'Equipo seleccionado'} · {selectedAsset.modelo} · {selectedAsset.numero_serie}</span><button type="button" className={BUTTON} onClick={() => { setSelectedAsset(null); update('asset_uid', ''); }}>Quitar vínculo</button></div> : <>
          <label className="mt-3 block text-sm">Buscar equipo<input className={`${INPUT} mt-1`} value={assetQuery} maxLength={300} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Código TI, modelo o serie" /></label>
          {finding && <p role="status" className="mt-2 text-xs text-slate-400">Buscando equipos…</p>}
          {assetError && <p role="alert" className="mt-2 text-sm text-red-400">{assetError}</p>}
          {!finding && assetQuery.trim() && !assets.length && !assetError && <p className="mt-2 text-xs text-slate-400">Sin coincidencias. Puedes guardar la referencia sin vincular un equipo.</p>}
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto">{assets.map((asset) => <li key={asset.asset_uid}><button type="button" className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700" onClick={() => { setSelectedAsset(asset); update('asset_uid', asset.asset_uid); setAssetQuery(''); }}>{asset.center_code} · {asset.marca} {asset.modelo}<span className="block text-xs text-slate-400">{asset.numero_serie || asset.service_tag || 'Sin serie registrada'}</span></button></li>)}</ul>
        </>}
      </div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Visible para usuarios con acceso a Activos. El autor y los administradores pueden editarla.</p><div className="flex gap-2"><button type="button" className={BUTTON} disabled={saving} onClick={() => { if (!dirty || window.confirm('¿Descartar los cambios sin guardar?')) onCancel(); }}>Cancelar</button><button type="submit" className={PRIMARY} disabled={saving}>{saving ? 'Guardando…' : 'Guardar referencia'}</button></div></div>
  </form>;
}

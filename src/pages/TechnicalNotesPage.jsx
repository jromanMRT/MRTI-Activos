import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch, apiImageBlobUrl, apiUpload } from '../api.js';

const MAX_NOTE_IMAGES = 6;

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
          {note.image_count > 0 && <NoteImages noteId={note.id} canEdit={false} />}
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
  // Antes de guardar la referencia todavía no existe un id al que asociar imágenes
  // en el servidor, así que las que se eligen aquí se quedan en el navegador
  // (con su propia miniatura local) y se suben recién al guardar.
  const [pendingImages, setPendingImages] = useState([]);
  const [createdNote, setCreatedNote] = useState(null);
  const activeNote = createdNote || note;
  useEffect(() => () => { pendingImages.forEach((entry) => URL.revokeObjectURL(entry.previewUrl)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function addPendingImage(file) {
    setDirty(true);
    setPendingImages((current) => [...current, { file, previewUrl: URL.createObjectURL(file) }]);
  }
  function removePendingImage(index) {
    setDirty(true);
    setPendingImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }
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
  async function uploadPendingImages(noteId, images) {
    const remaining = [...images];
    while (remaining.length) {
      const entry = remaining[0];
      const formData = new FormData();
      formData.append('file', entry.file);
      await apiUpload(`/technical-notes/${noteId}/images`, formData);
      URL.revokeObjectURL(entry.previewUrl);
      remaining.shift();
      setPendingImages([...remaining]);
    }
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      let savedId = activeNote.id;
      if (savedId) {
        await apiFetch(`/technical-notes/${savedId}`, { method: 'PATCH', body: JSON.stringify({ ...form, revision: activeNote.revision }) });
      } else {
        const response = await apiFetch('/technical-notes', { method: 'POST', body: JSON.stringify(form) });
        savedId = response.data.id;
        setCreatedNote(response.data);
      }
      if (pendingImages.length) {
        try {
          await uploadPendingImages(savedId, pendingImages);
        } catch (imageError) {
          throw new Error(`La referencia se guardó, pero una imagen no se pudo subir: ${imageError.message}`);
        }
      }
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
        <h3 className="text-sm font-semibold">Imágenes de referencia</h3>
        <p className="mt-1 text-xs text-slate-400">Una foto de la etiqueta, el número de parte o la especificación ayuda a comprar exactamente lo correcto.</p>
        <div className="mt-3">
          {activeNote.id
            ? <NoteImages noteId={activeNote.id} canEdit />
            : <PendingImages images={pendingImages} onAdd={addPendingImage} onRemove={removePendingImage} />}
        </div>
      </div>
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

// Las imágenes viven en disco en el servidor (ver server/src/imageStorage.js),
// no como blob en la base de datos; aquí sólo se listan metadatos y se piden
// los binarios uno por uno para las miniaturas.
// Imágenes elegidas para una nota que todavía no existe en el servidor: sólo
// viven en el navegador (miniatura vía URL.createObjectURL) hasta el guardado.
function PendingImages({ images, onAdd, onRemove }) {
  const fileRef = useRef(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  function handleChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onAdd(file);
  }
  const lightboxItems = images.map((entry) => ({ key: entry.previewUrl, url: entry.previewUrl, label: entry.file.name }));
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((entry, index) => (
            <div key={entry.previewUrl} className="group relative">
              <button type="button" onClick={() => setLightboxIndex(index)} className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-700 bg-slate-800" title="Ver en grande">
                <img src={entry.previewUrl} alt={entry.file.name} className="h-full w-full object-cover" />
              </button>
              <button type="button" onClick={() => onRemove(index)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white group-hover:flex" aria-label="Quitar imagen">×</button>
            </div>
          ))}
        </div>
      )}
      {images.length < MAX_NOTE_IMAGES && (
        <>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleChange} className="hidden" />
          <button type="button" className={BUTTON} onClick={() => fileRef.current?.click()}>+ Agregar imagen</button>
        </>
      )}
      <p className="text-xs text-slate-500">Se suben al guardar la referencia.</p>
      {lightboxIndex !== null && <ImageLightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onSelect={setLightboxIndex} />}
    </div>
  );
}

function NoteImages({ noteId, canEdit }) {
  const [images, setImages] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    apiFetch(`/technical-notes/${noteId}/images`)
      .then((body) => { if (current) setImages(body.data || []); })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [noteId, refresh]);

  useEffect(() => {
    let current = true;
    const objectUrls = [];
    setUrls({});
    (async () => {
      for (const image of images) {
        try {
          const url = await apiImageBlobUrl(`/technical-notes/${noteId}/images/${image.id}/file`);
          if (!current) { URL.revokeObjectURL(url); continue; }
          objectUrls.push(url);
          setUrls((previous) => ({ ...previous, [image.id]: url }));
        } catch { /* se omite esta miniatura si la imagen ya no está disponible */ }
      }
    })();
    return () => { current = false; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [images, noteId]);

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiUpload(`/technical-notes/${noteId}/images`, formData);
      setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function remove(image) {
    if (!window.confirm('¿Quitar esta imagen de la referencia?')) return;
    setError('');
    try {
      await apiFetch(`/technical-notes/${noteId}/images/${image.id}`, { method: 'DELETE' });
      setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
  }

  if (loading) return <p className="text-xs text-slate-500">Cargando imágenes…</p>;

  const lightboxItems = images.map((image) => ({ key: image.id, url: urls[image.id], label: image.original_name || 'Imagen de la referencia' }));

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <div key={image.id} className="group relative">
              {urls[image.id]
                ? <button type="button" onClick={() => setLightboxIndex(index)} className="block h-20 w-20 overflow-hidden rounded-lg border border-slate-700 bg-slate-800" title="Ver en grande">
                    <img src={urls[image.id]} alt={image.original_name || 'Imagen de la referencia'} className="h-full w-full object-cover" />
                  </button>
                : <div className="h-20 w-20 animate-pulse rounded-lg border border-slate-800 bg-slate-800" />}
              {canEdit && (
                <button type="button" onClick={() => remove(image)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white group-hover:flex" aria-label="Quitar imagen">×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && images.length < MAX_NOTE_IMAGES && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" disabled={uploading} onChange={upload} className="hidden" />
          <button type="button" className={BUTTON} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Subiendo…' : '+ Agregar imagen'}</button>
        </div>
      )}
      {lightboxIndex !== null && <ImageLightbox items={lightboxItems} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onSelect={setLightboxIndex} />}
    </div>
  );
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.4;
const PAN_EXTRA_MARGIN = 48;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Técnica clásica y sin ambigüedad: la imagen se centra con
// position:absolute + transform (no depende de flexbox ni de porcentajes
// que un navegador podría no resolver), y el zoom es un scale() puro sobre
// esa misma imagen -- un solo número que multiplica ancho y alto por igual,
// así que no hay forma de que se estire sólo en un eje. Mover la vista
// mientras está acercada es otro translate() sumado, sin tocar scroll.
function ImagePanZoom({ url, label }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const zoomRef = useRef(1);
  const dragStateRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Cuánto se puede mover la imagen sin perderla de vista: la mitad de lo
  // que sobresale del recuadro (para poder centrar cualquier orilla), más
  // un margen extra para no quedar exactamente al ras del borde.
  function getMaxPan() {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: 0, y: 0 };
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const overflowX = imgRect.width - containerRect.width;
    const overflowY = imgRect.height - containerRect.height;
    return {
      x: overflowX > 0 ? overflowX / 2 + PAN_EXTRA_MARGIN : 0,
      y: overflowY > 0 ? overflowY / 2 + PAN_EXTRA_MARGIN : 0,
    };
  }

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    if (zoom <= ZOOM_MIN) { setPan({ x: 0, y: 0 }); return; }
    const max = getMaxPan();
    setPan((p) => ({ x: clamp(p.x, -max.x, max.x), y: clamp(p.y, -max.y, max.y) }));
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(event) {
      event.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Arrastrar con el clic izquierdo para mover la imagen ampliada.
  function startDrag(event) {
    if (event.button !== 0 || zoomRef.current <= ZOOM_MIN) return;
    event.preventDefault();
    containerRef.current?.setPointerCapture?.(event.pointerId);
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  }
  function onDragMove(event) {
    const state = dragStateRef.current;
    if (!state) return;
    const max = getMaxPan();
    setPan({
      x: clamp(state.panX + (event.clientX - state.startX), -max.x, max.x),
      y: clamp(state.panY + (event.clientY - state.startY), -max.y, max.y),
    });
  }
  function endDrag() {
    dragStateRef.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg"
      style={{ cursor: zoom > ZOOM_MIN ? (dragging ? 'grabbing' : 'grab') : 'default', touchAction: 'none' }}
      onPointerDown={startDrag}
      onPointerMove={onDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        ref={imgRef}
        src={url}
        alt={label}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          maxWidth: '100%',
          maxHeight: '100%',
          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
        className="select-none rounded"
      />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-slate-300">{Math.round(zoom * 100)}% · rueda para acercar/alejar{zoom > ZOOM_MIN ? ' · arrastra para mover' : ''}</span>
    </div>
  );
}

// Visor compartido por NoteImages (imágenes ya guardadas) y PendingImages
// (elegidas antes de guardar la referencia): sólo necesita una url por elemento,
// sin que le importe si viene de un blob del servidor o de un File local.
function ImageLightbox({ items, index, onClose, onSelect }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onSelect((current) => Math.min(current + 1, items.length - 1));
      else if (event.key === 'ArrowLeft') onSelect((current) => Math.max(current - 1, 0));
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [items.length, onClose, onSelect]);

  const item = items[index];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.label}{items.length > 1 ? ` · ${index + 1} de ${items.length}` : ''}</p>
          <button type="button" onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800" aria-label="Cerrar">×</button>
        </div>
        {/* Ojo: NUNCA "flex-1" aquí -- en Tailwind eso es flex-basis:0%, que
            ignora por completo este "height" inline y colapsa la caja a 0
            si el modal (el padre) no tiene una altura propia definida. */}
        <div className="rounded-lg bg-black/40" style={{ height: '52vh' }}>
          {item.url ? <ImagePanZoom key={item.key} url={item.url} label={item.label} /> : <div className="flex h-full items-center justify-center"><p className="text-sm text-slate-400">Cargando imagen…</p></div>}
        </div>
        {items.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {items.map((thumb, thumbIndex) => (
              <button key={thumb.key} type="button" onClick={() => onSelect(thumbIndex)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${thumbIndex === index ? 'border-sky-400' : 'border-transparent'}`}>
                {thumb.url ? <img src={thumb.url} alt={thumb.label} className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-slate-800" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

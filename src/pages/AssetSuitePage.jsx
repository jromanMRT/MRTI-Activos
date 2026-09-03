import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiDownload, apiFetch } from '../api.js';

export const CATALOGS = {
  credenciales: { title: 'Credenciales de equipos', description: 'Cuentas y licencias asociadas. Las contraseñas de los activos no se copian.', columns: [['center_code', 'Centro'], ['usuario_asignado', 'Usuario'], ['win_usuario', 'Windows'], ['ms_usuario', 'Microsoft'], ['ms_licencia', 'Licencia'], ['correo_mrt', 'Correo MRT'], ['av_caducidad', 'Caducidad antivirus']] },
  componentes: { title: 'Componentes', columns: [['center_code', 'Centro'], ['code', 'Código'], ['nombre', 'Nombre'], ['tipo', 'Tipo'], ['marca', 'Marca'], ['modelo', 'Modelo'], ['serial_service_tag', 'Serie'], ['usuario', 'Usuario']] },
  impresoras: { title: 'Impresoras', columns: [['usuario', 'Usuario'], ['ubicacion', 'Ubicación'], ['ip_address', 'IP'], ['hostname', 'Host'], ['modelo', 'Modelo'], ['numero_serie', 'Serie'], ['conteo_paginas', 'Páginas']] },
  nvr: { title: 'NVR y CCTV', secret: true, columns: [['alias', 'Alias'], ['device_domain', 'Dominio'], ['device_serial', 'Serie'], ['ip_port', 'IP / puerto'], ['status', 'Estado'], ['usuario', 'Usuario'], ['localidad', 'Localidad'], ['ubicacion', 'Ubicación']] },
  passwords: { title: 'Contraseñas de red', secret: true, columns: [['categoria', 'Categoría'], ['subcategoria', 'Subcategoría'], ['ip', 'IP'], ['direccion', 'Dirección'], ['usuario', 'Usuario'], ['comentario', 'Comentario']] },
  starlink: { title: 'Starlink', columns: [['correo_cuenta', 'Cuenta'], ['ubicacion', 'Ubicación'], ['id_starlink', 'ID Starlink'], ['version_equipo', 'Versión'], ['importe_mes', 'Importe mensual'], ['dia_corte', 'Corte'], ['suscripcion', 'Suscripción'], ['cliente', 'Cliente']] },
  fortigate: { title: 'FortiGate', columns: [['software', 'Software'], ['numero_serie', 'Serie'], ['proyecto', 'Proyecto'], ['fecha_expira', 'Vencimiento'], ['comentario', 'Comentario']] },
  dominios: { title: 'Dominios', columns: [['dominio', 'Dominio'], ['servicios', 'Servicios'], ['fecha_expira', 'Vencimiento'], ['status', 'Estado'], ['comentario', 'Comentario']] },
  mantenimientos: { title: 'Mantenimientos', columns: [['center_code', 'Centro'], ['fecha_servicio', 'Fecha'], ['tipo_servicio', 'Servicio'], ['descripcion', 'Descripción'], ['tecnico', 'Técnico'], ['proveedor', 'Proveedor'], ['estado', 'Estado'], ['costo', 'Costo']] },
  unidades: { title: 'Unidades', columns: [['nombre', 'Nombre'], ['activa', 'Activa'], ['orden', 'Orden']] },
  documentos: { title: 'Documentos', document: true, columns: [['center_code', 'Centro'], ['nombre', 'Nombre'], ['tipo', 'Tipo'], ['archivo', 'Archivo'], ['subido_por', 'Subido por'], ['sap_creado_en', 'Fecha']] },
  'config-alertas': { title: 'Configuración de alertas', archivable: false, columns: [['clave', 'Clave'], ['nombre', 'Nombre'], ['dias_aviso', 'Días de aviso'], ['activo', 'Activa'], ['synced_at', 'Sincronización']] },
};

function profile() { try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; } }
function display(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === 1) return 'Sí'; if (value === 0) return 'No';
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleDateString('es-MX');
  return String(value);
}

const TABLE_COLLATOR = new Intl.Collator('es-MX', { numeric: true, sensitivity: 'base' });
const COLUMN_LABELS = {
  center_code: 'Código TI', source_ids: 'IDs de origen', detected_at: 'Detectado', last_seen_at: 'Última detección',
  tipo: 'Tipo', marca: 'Marca', modelo: 'Modelo', numero_serie: 'Serie', usuario_asignado: 'Usuario asignado',
  ms_cuenta: 'Cuenta Microsoft', ms_licencia: 'Licencia Microsoft', software: 'Software', proyecto: 'Proyecto',
  fecha_expira: 'Vencimiento', av_licencia: 'Licencia antivirus', fecha_vence: 'Vencimiento',
};
function columnLabel(field) { return COLUMN_LABELS[field] || field.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
function sortTableRows(rows, field, order) {
  return [...rows].sort((left, right) => {
    const a = left[field]; const b = right[field];
    const aEmpty = a === null || a === undefined || a === ''; const bEmpty = b === null || b === undefined || b === '';
    if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : TABLE_COLLATOR.compare(String(a), String(b));
    return order === 'asc' ? comparison : -comparison;
  });
}

export function AssetSuiteOverviewPage() {
  const [summary, setSummary] = useState(null); const [dashboard, setDashboard] = useState(null); const [alerts, setAlerts] = useState(null); const [error, setError] = useState(''); const [syncing, setSyncing] = useState(false);
  const isAdmin = profile().role === 'administrator';
  async function load() {
    setError('');
    const results = await Promise.allSettled([
      apiFetch('/activos-suite/summary'),
      apiFetch('/activos-suite/dashboard'),
      apiFetch('/activos-suite/alerts'),
    ]);
    if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
    if (results[1].status === 'fulfilled') setDashboard(results[1].value.data);
    if (results[2].status === 'fulfilled') setAlerts(results[2].value.data);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) setError(failures.length === results.length ? failures[0].reason.message : 'Parte del dashboard no pudo actualizarse. La información disponible permanece visible.');
  }
  useEffect(() => { void load(); }, []);
  async function sync() { setSyncing(true); setError(''); try { await apiFetch('/activos-suite/sync', { method: 'POST', body: '{}' }); await load(); } catch (err) { setError(err.message); } finally { setSyncing(false); } }
  const inventory = dashboard?.inventory;
  const alertItems = alerts ? [
    { title: 'Sin documentos', count: alerts.sin_documentos, detail: 'Activos sin respaldo adjunto', tone: 'red' },
    { title: 'Datos incompletos', count: alerts.incompletos.length, detail: 'Falta información esencial', tone: 'amber' },
    { title: 'Antivirus', count: alerts.antivirus.length, detail: 'Vencidos o próximos a vencer', tone: 'amber' },
    { title: 'Office 365', count: alerts.office365.length, detail: 'Renovaciones en 90 días', tone: 'amber' },
    { title: 'FortiGate', count: alerts.fortigate.length, detail: 'Licencias por atender', tone: 'amber' },
    { title: 'Duplicados', count: alerts.duplicados.length, detail: 'Códigos repetidos en origen', tone: 'red' },
  ] : [];
  const catalogHighlights = ['documentos', 'mantenimientos', 'componentes', 'impresoras', 'fortigate', 'dominios'];
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">MRTI Activos</p><h1 className="mt-1 text-2xl font-bold">Dashboard de activos</h1><p className="mt-1 text-sm text-slate-400">Estado general del inventario, documentación y pendientes que requieren atención.</p></div><div className="flex flex-wrap gap-2"><Link to="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Abrir inventario</Link><Link to="/alertas" className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10">Ver todas las alertas</Link>{isAdmin && <button onClick={sync} disabled={syncing} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-[#2a1c05] disabled:opacity-50">{syncing ? 'Sincronizando…' : 'Actualizar desde origen'}</button>}</div></div>
    {error && <Message error={error} />}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard title="Total inventariado" value={inventory?.total} detail="Todos los estados" />
      <MetricCard title="Activos en operación" value={inventory?.activos} detail="Disponibles o asignados" tone="emerald" />
      <MetricCard title="Asignados" value={inventory?.asignados} detail={inventory ? `${inventory.sin_asignar} activos sin asignar` : ''} />
      <MetricCard title="En mantenimiento" value={inventory?.mantenimiento} detail="Atención técnica actual" tone="amber" />
      <MetricCard title="Cobertura documental" value={inventory ? `${Math.round((inventory.con_documentos / Math.max(inventory.activos, 1)) * 100)}%` : null} detail={inventory ? `${inventory.con_documentos} de ${inventory.activos} activos` : ''} />
    </div>

    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Alertas principales</h2><p className="text-sm text-slate-500">Mismos controles operativos del sistema anterior, calculados sobre la copia vigente.</p></div><Link to="/alertas" className="text-sm text-sky-400 hover:underline">Abrir detalle →</Link></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{alertItems.length ? alertItems.map((item) => <DashboardAlert key={item.title} {...item} />) : Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/50" />)}</div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <Distribution title="Activos por tipo" rows={dashboard?.by_type || []} total={inventory?.activos || 0} />
      <Distribution title="Activos por unidad" rows={dashboard?.by_unit || []} total={inventory?.activos || 0} />
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"><h2 className="font-semibold">Activos actualizados recientemente</h2><div className="mt-3 divide-y divide-slate-800">{dashboard?.recent_assets?.map((asset) => <Link key={asset.id} to={`/${asset.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 hover:text-sky-400"><div className="min-w-0"><p className="truncate text-sm font-medium">{asset.center_code} · {[asset.marca, asset.modelo].filter(Boolean).join(' ') || asset.tipo || 'Activo'}</p><p className="mt-0.5 truncate text-xs text-slate-500">{asset.usuario_asignado || 'Sin asignar'} · {asset.estado}</p></div><span className="shrink-0 text-xs text-slate-500">Abrir →</span></Link>)}{dashboard && !dashboard.recent_assets?.length && <p className="py-5 text-sm text-slate-500">Sin actividad reciente.</p>}</div></section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"><div className="flex justify-between gap-3"><h2 className="font-semibold">Documentos recientes</h2><Link to="/catalogos/documentos" className="text-sm text-sky-400 hover:underline">Ver todos</Link></div><div className="mt-3 divide-y divide-slate-800">{dashboard?.recent_documents?.map((document) => <div key={document.id} className="flex items-center justify-between gap-3 py-3 first:pt-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{document.nombre || document.archivo}</p><p className="mt-0.5 truncate text-xs text-slate-500">{document.center_code || 'Sin código'} · {document.tipo || 'Documento'} · {document.subido_por || 'Origen importado'}</p></div>{document.asset_id && <Link to={`/${document.asset_id}?tab=documentos`} className="shrink-0 text-xs text-sky-400 hover:underline">Activo</Link>}</div>)}{dashboard && !dashboard.recent_documents?.length && <p className="py-5 text-sm text-slate-500">Todavía no hay documentos.</p>}</div></section>
    </div>

    <section><h2 className="mb-3 text-lg font-semibold">Catálogos operativos</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{catalogHighlights.map((key) => <Link key={key} to={`/catalogos/${key}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-sky-500/50"><div className="flex items-center justify-between"><p className="text-sm text-slate-300">{CATALOGS[key].title}</p><span className="text-lg font-bold text-sky-400">{summary ? summary[key]?.total ?? 0 : '…'}</span></div><p className="mt-2 text-xs text-slate-500">Consultar catálogo →</p></Link>)}</div></section>
  </div>;
}

function MetricCard({ title, value, detail, tone = 'sky' }) { const colors = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-sky-400'; return <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-sm text-slate-400">{title}</p><p className={`mt-2 text-3xl font-bold ${colors}`}>{value ?? '…'}</p><p className="mt-2 text-xs text-slate-500">{detail || 'Cargando información…'}</p></article>; }
function DashboardAlert({ title, count, detail, tone }) { const active = Number(count) > 0; const colors = tone === 'red' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'; return <Link to="/alertas" className={`rounded-xl border p-4 transition hover:-translate-y-0.5 ${active ? colors : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs opacity-70">{active ? detail : 'Sin pendientes'}</p></div><span className="text-2xl font-bold">{count}</span></div></Link>; }
function Distribution({ title, rows, total }) { const max = Math.max(...rows.map((row) => row.total), 1); return <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"><h2 className="font-semibold">{title}</h2><div className="mt-4 space-y-3">{rows.map((row) => <div key={row.label}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-slate-300">{row.label}</span><span className="text-slate-500">{row.total} · {Math.round((row.total / Math.max(total, 1)) * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max((row.total / max) * 100, 3)}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-slate-500">Cargando distribución…</p>}</div></section>; }

export function AssetCatalogPage() {
  const { resource } = useParams(); const config = CATALOGS[resource]; const isAdmin = profile().role === 'administrator';
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [includeArchived, setIncludeArchived] = useState(false); const [sort, setSort] = useState(''); const [order, setOrder] = useState('asc'); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revealed, setRevealed] = useState({});
  const activeSort = config?.columns.some(([key]) => key === sort) ? sort : config?.columns[0]?.[0] || '';
  const query = useMemo(() => { const p = new URLSearchParams(); if (q) p.set('q', q); if (includeArchived) p.set('includeArchived', '1'); if (activeSort) p.set('sort', activeSort); p.set('order', order); return p.toString(); }, [q, includeArchived, activeSort, order]);
  function load() { if (!config) return; setLoading(true); setError(''); setRevealed({}); apiFetch(`/activos-suite/resources/${resource}?${query}`).then((body) => setRows(body.data)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }
  useEffect(() => { void load(); }, [resource, query]);
  if (!config) return <Message error="Catálogo no reconocido" />;
  function changeSort(nextSort) { if (activeSort === nextSort) setOrder((current) => current === 'asc' ? 'desc' : 'asc'); else { setSort(nextSort); setOrder('asc'); } }
  async function toggleArchive(row) { try { await apiFetch(`/activos-suite/resources/${resource}/${row.id}/${row.archived_at ? 'restore' : 'archive'}`, { method: 'PATCH', body: '{}' }); load(); } catch (err) { setError(err.message); } }
  async function toggleReveal(row) {
    if (Object.prototype.hasOwnProperty.call(revealed, row.id)) { setRevealed((current) => { const next = { ...current }; delete next[row.id]; return next; }); return; }
    try { const body = await apiFetch(`/activos-suite/resources/${resource}/${row.id}/secret`); setRevealed((current) => ({ ...current, [row.id]: body.data })); } catch (err) { setError(err.message); }
  }
  async function download(row) { try { await apiDownload(`/activos-suite/documents/${row.id}/download`, row.archivo); } catch (err) { setError(err.message); } }
  const actions = (isAdmin && config.archivable !== false) || (isAdmin && config.secret) || config.document;
  return <div>
    <div className="mb-5"><Link to="/operacion" className="text-sm text-sky-400 hover:underline">← Operación de activos</Link><h1 className="mt-2 text-2xl font-bold">{config.title}</h1>{config.description && <p className="mt-1 text-sm text-slate-400">{config.description}</p>}</div>
    <div className="mb-4 flex flex-wrap gap-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="min-w-64 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm" />{isAdmin && config.archivable !== false && <label className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 text-sm text-slate-300"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Mostrar archivados</label>}</div>
    {error && <Message error={error} />}
    <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{config.columns.map(([key, label]) => <SortableTh key={key} sortKey={key} sort={activeSort} order={order} onSort={changeSort}>{label}</SortableTh>)}{actions && <th className="px-4 py-3 font-medium">Acciones</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={config.columns.length + (actions ? 1 : 0)} className="p-8 text-center text-slate-500">Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={config.columns.length + (actions ? 1 : 0)} className="p-8 text-center text-slate-500">Sin resultados</td></tr> : rows.map((row) => <tr key={row.id ?? row.clave} className={`border-t border-slate-800 ${row.archived_at ? 'opacity-55' : 'hover:bg-slate-900/60'}`}>{config.columns.map(([key]) => <td key={key} className="max-w-72 px-4 py-3"><span className="block truncate" title={display(row[key])}>{display(row[key])}</span>{key === config.columns[0][0] && Object.prototype.hasOwnProperty.call(revealed, row.id) && <span className="mt-2 block whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-xs text-amber-300">{Object.entries(revealed[row.id]).map(([name, value]) => `${name}: ${value || '—'}`).join('\n')}</span>}</td>)}{actions && <td className="whitespace-nowrap px-4 py-3"><div className="flex gap-2">{config.document && row.local_storage_path && <button onClick={() => download(row)} className="text-sky-400 hover:underline">Descargar</button>}{isAdmin && config.secret && <button onClick={() => toggleReveal(row)} className="text-amber-400 hover:underline">{Object.prototype.hasOwnProperty.call(revealed, row.id) ? 'Ocultar claves' : 'Ver claves'}</button>}{isAdmin && config.archivable !== false && <button onClick={() => toggleArchive(row)} className={row.archived_at ? 'text-emerald-400 hover:underline' : 'text-red-400 hover:underline'}>{row.archived_at ? 'Restaurar' : 'Archivar'}</button>}</div></td>}</tr>)}</tbody></table></div>
  </div>;
}

export function AssetAlertsPage() {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [selectedAlert, setSelectedAlert] = useState('all');
  useEffect(() => { apiFetch('/activos-suite/alerts').then((body) => setData(body.data)).catch((err) => setError(err.message)); }, []);
  if (error) return <Message error={error} />; if (!data) return <p className="text-slate-500">Cargando alertas…</p>;
  const sections = [
    { key: 'duplicados', label: 'Duplicados', title: 'Códigos duplicados en el origen', rows: data.duplicados, fields: ['center_code', 'source_ids', 'detected_at', 'last_seen_at'] },
    { key: 'sin_documentos', label: 'Sin documentos', title: 'Activos sin documentos', count: data.sin_documentos, rows: data.sin_documentos_detalle || [], fields: ['center_code', 'tipo', 'marca', 'modelo', 'usuario_asignado', 'unidad'] },
    { key: 'incompletos', label: 'Datos incompletos', title: 'Datos incompletos', rows: data.incompletos, fields: ['center_code', 'tipo', 'marca', 'modelo', 'numero_serie', 'usuario_asignado'] },
    { key: 'perpetuas', label: 'Licencias perpetuas', title: 'Licencias perpetuas', rows: data.perpetuas, fields: ['center_code', 'usuario_asignado', 'ms_cuenta', 'ms_licencia'] },
    { key: 'fortigate', label: 'FortiGate', title: 'FortiGate vencido o próximo', rows: data.fortigate, fields: ['software', 'numero_serie', 'proyecto', 'fecha_expira'] },
    { key: 'antivirus', label: 'Antivirus', title: 'Antivirus vencido o próximo', rows: data.antivirus, fields: ['center_code', 'usuario_asignado', 'av_licencia', 'fecha_vence'] },
    { key: 'office365', label: 'Office 365', title: 'Office 365 vencido o próximo', rows: data.office365, fields: ['center_code', 'usuario_asignado', 'ms_licencia', 'fecha_vence'] },
  ].map((section) => ({ ...section, count: section.count ?? section.rows.length }));
  const visibleSections = selectedAlert === 'all' ? sections : sections.filter((section) => section.key === selectedAlert);
  const totalAlerts = sections.reduce((total, section) => total + Number(section.count || 0), 0);
  return <div>
    <h1 className="text-2xl font-bold">Alertas de activos</h1>
    <p className="mt-1 text-sm text-slate-400">Selecciona un tipo para revisar sólo los pendientes que necesitas.</p>
    <div className="my-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filtrar por tipo de alerta">
      <AlertFilter active={selectedAlert === 'all'} count={totalAlerts} onClick={() => setSelectedAlert('all')}>Todas</AlertFilter>
      {sections.map((section) => <AlertFilter key={section.key} active={selectedAlert === section.key} count={section.count} onClick={() => setSelectedAlert(section.key)}>{section.label}</AlertFilter>)}
    </div>
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {sections.map((section) => <AlertCard key={section.key} title={section.label} count={section.count} active={selectedAlert === section.key} onClick={() => setSelectedAlert(section.key)} />)}
    </div>
    <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-400">Mostrando: <span className="font-semibold text-slate-200">{selectedAlert === 'all' ? 'Todas las alertas' : sections.find((section) => section.key === selectedAlert)?.label}</span></p>{selectedAlert !== 'all' && <button type="button" onClick={() => setSelectedAlert('all')} className="text-sm text-sky-400 hover:underline">Mostrar todas</button>}</div>
    {visibleSections.map((section) => <AlertTable key={section.key} title={section.title} rows={section.rows} fields={section.fields} total={section.count} />)}
  </div>;
}

function AlertFilter({ children, active, count, onClick }) { return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${active ? 'border-sky-400 bg-sky-500/15 text-sky-300' : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-500'}`}>{children}<span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-sky-400/20' : 'bg-slate-800'}`}>{count}</span></button>; }
function AlertCard({ title, count, active, onClick }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${active ? 'border-sky-400 bg-sky-500/15 ring-1 ring-sky-400/40' : 'border-amber-500/30 bg-amber-500/10'}`}><p className={active ? 'text-sm text-sky-200' : 'text-sm text-amber-200'}>{title}</p><p className={active ? 'mt-2 text-3xl font-bold text-sky-300' : 'mt-2 text-3xl font-bold text-amber-400'}>{count}</p><p className="mt-1 text-xs text-slate-500">Ver sólo esta alerta</p></button>; }
function AlertTable({ title, rows, fields, total = rows.length }) {
  const [sort, setSort] = useState(fields[0]); const [order, setOrder] = useState('asc');
  const sortedRows = useMemo(() => sortTableRows(rows, sort, order), [rows, sort, order]);
  function changeSort(nextSort) { if (sort === nextSort) setOrder((current) => current === 'asc' ? 'desc' : 'asc'); else { setSort(nextSort); setOrder('asc'); } }
  return <section className="mb-5 rounded-xl border border-slate-800 p-4"><h2 className="mb-3 font-semibold">{title} <span className="text-slate-500">({total})</span></h2>{rows.length === 0 ? <p className="text-sm text-slate-500">Sin pendientes.</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{fields.map((field) => <SortableTh key={field} sortKey={field} sort={sort} order={order} onSort={changeSort}>{columnLabel(field)}</SortableTh>)}</tr></thead><tbody>{sortedRows.map((row, index) => <tr key={row.id || index} className="border-t border-slate-800">{fields.map((field) => <td key={field} className="px-3 py-2">{display(row[field])}</td>)}</tr>)}</tbody></table>{total > rows.length && <p className="mt-3 text-xs text-slate-500">Se muestran los primeros {rows.length} de {total} pendientes.</p>}</div>}</section>;
}
function SortableTh({ children, sortKey, sort, order, onSort }) { const active = sort === sortKey; return <th className="whitespace-nowrap px-4 py-3 font-medium" aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}><button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-slate-200 ${active ? 'text-sky-400' : ''}`}>{children}<span aria-hidden="true" className="text-[9px]">{active ? (order === 'asc' ? '▲' : '▼') : '⇅'}</span></button></th>; }
function Message({ error }) { return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>; }

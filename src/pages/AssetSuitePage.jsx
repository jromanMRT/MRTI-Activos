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

export function AssetSuiteOverviewPage() {
  const [summary, setSummary] = useState(null); const [error, setError] = useState(''); const [syncing, setSyncing] = useState(false);
  const isAdmin = profile().role === 'administrator';
  const load = () => apiFetch('/activos-suite/summary').then((body) => setSummary(body.data)).catch((err) => setError(err.message));
  useEffect(load, []);
  async function sync() { setSyncing(true); setError(''); try { await apiFetch('/activos-suite/sync', { method: 'POST', body: '{}' }); await load(); } catch (err) { setError(err.message); } finally { setSyncing(false); } }
  return <div>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">Operación de activos</h1><p className="mt-1 text-sm text-slate-400">Información migrada de la aplicación anterior, ahora dentro de MRTI-Activos.</p></div>{isAdmin && <button onClick={sync} disabled={syncing} className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-[#2a1c05] disabled:opacity-50">{syncing ? 'Sincronizando…' : 'Actualizar desde origen'}</button>}</div>
    {error && <Message error={error} />}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(CATALOGS).map(([key, item]) => <Link key={key} to={`/catalogos/${key}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-sky-500/50"><p className="text-sm text-slate-400">{item.title}</p><p className="mt-2 text-3xl font-bold text-sky-400">{summary ? summary[key]?.total ?? 0 : '…'}</p><p className="mt-2 text-xs text-slate-500">Abrir catálogo →</p></Link>)}</div>
  </div>;
}

export function AssetCatalogPage() {
  const { resource } = useParams(); const config = CATALOGS[resource]; const isAdmin = profile().role === 'administrator';
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [includeArchived, setIncludeArchived] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revealed, setRevealed] = useState({});
  const query = useMemo(() => { const p = new URLSearchParams(); if (q) p.set('q', q); if (includeArchived) p.set('includeArchived', '1'); return p.toString(); }, [q, includeArchived]);
  function load() { if (!config) return; setLoading(true); setError(''); apiFetch(`/activos-suite/resources/${resource}?${query}`).then((body) => setRows(body.data)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }
  useEffect(load, [resource, query]);
  if (!config) return <Message error="Catálogo no reconocido" />;
  async function toggleArchive(row) { try { await apiFetch(`/activos-suite/resources/${resource}/${row.id}/${row.archived_at ? 'restore' : 'archive'}`, { method: 'PATCH', body: '{}' }); load(); } catch (err) { setError(err.message); } }
  async function reveal(row) { try { const body = await apiFetch(`/activos-suite/resources/${resource}/${row.id}/secret`); setRevealed((current) => ({ ...current, [row.id]: body.data })); } catch (err) { setError(err.message); } }
  async function download(row) { try { await apiDownload(`/activos-suite/documents/${row.id}/download`, row.archivo); } catch (err) { setError(err.message); } }
  const actions = (isAdmin && config.archivable !== false) || (isAdmin && config.secret) || config.document;
  return <div>
    <div className="mb-5"><Link to="/operacion" className="text-sm text-sky-400 hover:underline">← Operación de activos</Link><h1 className="mt-2 text-2xl font-bold">{config.title}</h1>{config.description && <p className="mt-1 text-sm text-slate-400">{config.description}</p>}</div>
    <div className="mb-4 flex flex-wrap gap-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="min-w-64 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm" />{isAdmin && config.archivable !== false && <label className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 text-sm text-slate-300"><input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Mostrar archivados</label>}</div>
    {error && <Message error={error} />}
    <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{config.columns.map(([key, label]) => <th key={key} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}{actions && <th className="px-4 py-3 font-medium">Acciones</th>}</tr></thead><tbody>{loading ? <tr><td colSpan={config.columns.length + 1} className="p-8 text-center text-slate-500">Cargando…</td></tr> : rows.length === 0 ? <tr><td colSpan={config.columns.length + 1} className="p-8 text-center text-slate-500">Sin resultados</td></tr> : rows.map((row) => <tr key={row.id ?? row.clave} className={`border-t border-slate-800 ${row.archived_at ? 'opacity-55' : 'hover:bg-slate-900/60'}`}>{config.columns.map(([key]) => <td key={key} className="max-w-72 px-4 py-3"><span className="block truncate" title={display(row[key])}>{display(row[key])}</span>{key === config.columns[0][0] && revealed[row.id] && <span className="mt-2 block whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-xs text-amber-300">{Object.entries(revealed[row.id]).map(([name, value]) => `${name}: ${value || '—'}`).join('\n')}</span>}</td>)}{actions && <td className="whitespace-nowrap px-4 py-3"><div className="flex gap-2">{config.document && row.local_storage_path && <button onClick={() => download(row)} className="text-sky-400 hover:underline">Descargar</button>}{isAdmin && config.secret && <button onClick={() => reveal(row)} className="text-amber-400 hover:underline">Ver claves</button>}{isAdmin && config.archivable !== false && <button onClick={() => toggleArchive(row)} className={row.archived_at ? 'text-emerald-400 hover:underline' : 'text-red-400 hover:underline'}>{row.archived_at ? 'Restaurar' : 'Archivar'}</button>}</div></td>}</tr>)}</tbody></table></div>
  </div>;
}

export function AssetAlertsPage() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => { apiFetch('/activos-suite/alerts').then((body) => setData(body.data)).catch((err) => setError(err.message)); }, []);
  if (error) return <Message error={error} />; if (!data) return <p className="text-slate-500">Cargando alertas…</p>;
  return <div><h1 className="text-2xl font-bold">Alertas de activos</h1><p className="mb-6 mt-1 text-sm text-slate-400">Pendientes calculados desde la copia local.</p><div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><AlertCard title="Duplicados en origen" count={data.duplicados.length} /><AlertCard title="Sin documentos" count={data.sin_documentos} /><AlertCard title="Datos incompletos" count={data.incompletos.length} /><AlertCard title="FortiGate" count={data.fortigate.length} /><AlertCard title="Antivirus" count={data.antivirus.length} /><AlertCard title="Office 365" count={data.office365.length} /></div><AlertTable title="Códigos duplicados en el origen" rows={data.duplicados} fields={['center_code', 'source_ids', 'detected_at', 'last_seen_at']} /><AlertTable title="Datos incompletos" rows={data.incompletos} fields={['center_code', 'tipo', 'marca', 'modelo', 'numero_serie', 'usuario_asignado']} /><AlertTable title="Licencias perpetuas" rows={data.perpetuas} fields={['center_code', 'usuario_asignado', 'ms_cuenta', 'ms_licencia']} /><AlertTable title="FortiGate vencido o próximo" rows={data.fortigate} fields={['software', 'numero_serie', 'proyecto', 'fecha_expira']} /><AlertTable title="Antivirus vencido o próximo" rows={data.antivirus} fields={['center_code', 'usuario_asignado', 'av_licencia', 'fecha_vence']} /><AlertTable title="Office 365 vencido o próximo" rows={data.office365} fields={['center_code', 'usuario_asignado', 'ms_licencia', 'fecha_vence']} /></div>;
}

function AlertCard({ title, count }) { return <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5"><p className="text-sm text-amber-200">{title}</p><p className="mt-2 text-3xl font-bold text-amber-400">{count}</p></div>; }
function AlertTable({ title, rows, fields }) { return <section className="mb-5 rounded-xl border border-slate-800 p-4"><h2 className="mb-3 font-semibold">{title} <span className="text-slate-500">({rows.length})</span></h2>{rows.length === 0 ? <p className="text-sm text-slate-500">Sin pendientes.</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><tbody>{rows.map((row, index) => <tr key={row.id || index} className="border-t border-slate-800 first:border-0">{fields.map((field) => <td key={field} className="px-3 py-2">{display(row[field])}</td>)}</tr>)}</tbody></table></div>}</section>; }
function Message({ error }) { return <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>; }

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiDownload, apiFetch, obsFetch, obsLinkDevice, obsUnlinkedDevices, ticketsFetch } from '../api.js';

export function AssetFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [observability, setObservability] = useState(null);
  const [observabilityError, setObservabilityError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [documentsError, setDocumentsError] = useState('');
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'general');

  useEffect(() => {
    setActiveTab(new URLSearchParams(location.search).get('tab') || 'general');
  }, [location.search, id]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !saving) navigate('/');
    }
    document.addEventListener('keydown', closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [navigate, saving]);

  useEffect(() => {
    Promise.all([
      apiFetch('/activos/meta'),
      mode === 'edit' ? apiFetch(`/activos/${id}`) : Promise.resolve({ data: {} }),
      mode === 'edit'
        ? apiFetch(`/activos/${id}/documentos`).catch((documentsRequestError) => {
            setDocumentsError(documentsRequestError.message);
            return { data: [] };
          })
        : Promise.resolve({ data: [] }),
    ])
      .then(([meta, asset, assetDocuments]) => {
        setGroups(meta.groups);
        setValues(asset.data || {});
        setDocuments(assetDocuments.data || []);
        if (asset.data?.asset_uid) {
          obsFetch(asset.data.asset_uid)
            .then(setObservability)
            .catch((err) => setObservabilityError(err.message));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [mode, id]);

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        const result = await apiFetch('/activos', { method: 'POST', body: JSON.stringify(values) });
        navigate(`/${result.data.id}`);
      } else {
        await apiFetch(`/activos/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Retirar este activo? Se conservará su historial y dejará de estar asignado.')) return;
    try {
      await apiFetch(`/activos/${id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  const groupsByKey = Object.fromEntries(groups.map((group) => [group.key, group]));
  const tabs = [
    { key: 'general', label: 'General', groups: ['identificacion', 'software'] },
    { key: 'asignacion', label: 'Asignación', groups: ['asignacion'] },
    { key: 'administracion', label: 'Administración', groups: ['compra', 'baja'] },
    { key: 'windows', label: 'Windows', groups: ['windows'] },
    { key: 'microsoft365', label: 'Microsoft', groups: ['microsoft365'] },
    { key: 'dropbox', label: 'Dropbox', groups: ['dropbox'] },
    { key: 'correo', label: 'Correo', groups: ['correo'] },
    { key: 'antivirus', label: 'Antivirus', groups: ['antivirus'] },
    ...(mode === 'edit' ? [
      { key: 'documentos', label: 'Documentos', count: documents.length },
      { key: 'monitor', label: 'Monitor' },
      { key: 'tickets', label: 'Tickets' },
    ] : []),
  ];

  const createTicketUrl = values.asset_uid
    ? `/?openTicket=1&asset_uid=${encodeURIComponent(values.asset_uid)}&asset_label=${encodeURIComponent(values.center_code || values.descripcion || '')}`
    : null;

  function closeModal() {
    if (!saving) navigate('/');
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <form onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title" className="flex h-full w-full flex-col overflow-hidden bg-slate-950 shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-2xl sm:border sm:border-slate-800">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 sm:px-7">
          <div>
            <h1 id="asset-dialog-title" className="text-xl font-bold sm:text-2xl">{mode === 'create' ? 'Nuevo activo' : 'Editar activo'}</h1>
            {mode === 'edit' && <p className="mt-1 text-sm text-slate-500">{values.center_code || 'Cargando información…'}{values.descripcion ? ` · ${values.descripcion}` : ''}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {createTicketUrl && <a href={createTicketUrl} className="rounded-lg border border-sky-500/40 px-3 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/10">Crear ticket</a>}
            <button type="button" onClick={closeModal} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-50" aria-label="Cerrar">×</button>
          </div>
        </header>

        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 px-4 pt-2 sm:px-7" aria-label="Secciones del activo">
          {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition ${activeTab === tab.key ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>{tab.label}{Number.isInteger(tab.count) && <span className="ml-1.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px]">{tab.count}</span>}</button>)}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}
          {loading ? <p className="py-12 text-center text-slate-500">Cargando activo…</p> : <>
            {tabs.find((tab) => tab.key === activeTab)?.groups?.map((groupKey) => {
              const group = groupsByKey[groupKey];
              if (!group) return null;
              return <section key={group.key} className="mb-7 last:mb-0"><h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{group.label}</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{group.fields.map((field) => <Field key={field.key} field={field} value={values[field.key]} onChange={setField} />)}</div></section>;
            })}
            {activeTab === 'asignacion' && mode === 'edit' && <div className="mt-6"><AssignmentPanel assetId={id} portalUserId={values.portal_user_id} terceroId={values.tercero_id} usuarioAsignado={values.usuario_asignado} onChange={() => apiFetch(`/activos/${id}`).then((r) => setValues(r.data)).catch((err) => setError(err.message))} /></div>}
            {activeTab === 'documentos' && mode === 'edit' && <DocumentsPanel documents={documents} error={documentsError} onError={setDocumentsError} />}
            {activeTab === 'monitor' && mode === 'edit' && <ObservabilityPanel assetUid={values.asset_uid} data={observability} error={observabilityError} onChange={() => obsFetch(values.asset_uid).then(setObservability).catch((err) => setObservabilityError(err.message))} />}
            {activeTab === 'tickets' && mode === 'edit' && <TicketsPanel assetUid={values.asset_uid} createTicketUrl={createTicketUrl} />}
          </>}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/50 px-5 py-4 sm:px-7">
          <div>{mode === 'edit' && <button type="button" onClick={handleDelete} disabled={saving || loading} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50">Retirar activo</button>}</div>
          <div className="flex gap-2"><button type="button" onClick={closeModal} disabled={saving} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancelar</button><button type="submit" disabled={saving || loading} className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-[#2a1c05] hover:bg-sky-400 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button></div>
        </footer>
      </form>
    </div>
  );
}

function DocumentsPanel({ documents, error, onError }) {
  const [downloadingId, setDownloadingId] = useState(null);

  async function download(document) {
    setDownloadingId(document.id);
    onError('');
    try {
      await apiDownload(`/activos-suite/documents/${document.id}/download`, document.archivo || 'documento.pdf');
    } catch (downloadError) {
      onError(downloadError.message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <fieldset className="border border-slate-800 rounded-xl p-4">
      <legend className="text-sm font-semibold text-slate-300 px-1">Facturas, remisiones y documentos</legend>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">Este activo no tiene documentos registrados en la plataforma anterior.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">{document.tipo || 'Documento'}</span>
                  <h3 className="mt-2 truncate font-medium text-slate-100" title={document.nombre || document.archivo}>{document.nombre || document.archivo}</h3>
                </div>
                <DocumentIcon />
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <p className="truncate" title={document.archivo}>{document.archivo}</p>
                {document.sap_creado_en && <p>{new Date(document.sap_creado_en).toLocaleString('es-MX')}</p>}
                {document.subido_por && <p>Subido por {document.subido_por}</p>}
              </div>
              <button type="button" onClick={() => download(document)} disabled={!document.archivo_disponible || downloadingId === document.id} className="mt-4 w-full rounded-lg border border-sky-500/40 px-3 py-2 text-sm font-medium text-sky-400 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                {!document.archivo_disponible ? 'Archivo no disponible' : downloadingId === document.id ? 'Descargando…' : 'Descargar PDF'}
              </button>
            </article>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></svg>;
}

// Quien tiene el activo hoy puede ser un empleado con cuenta en Core
// (portal_user_id, administrado desde ahí) o un tercero registrado en
// /terceros (contratista, proveedor, visita) -- este panel solo maneja la
// segunda vía; la primera sigue siendo cosa de Core.
function AssignmentPanel({ assetId, portalUserId, terceroId, usuarioAsignado, onChange }) {
  const [terceros, setTerceros] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/terceros').then((r) => setTerceros(r.data)).catch(() => {});
  }, []);

  async function assign() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/activos/${assetId}/asignaciones`, { method: 'POST', body: JSON.stringify({ tercero_id: selected }) });
      setSelected('');
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (!window.confirm('¿Quitar la asignación de este activo?')) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/activos/${assetId}/asignacion`, { method: 'DELETE' });
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="border border-slate-800 rounded-xl p-4">
      <legend className="text-sm font-semibold text-slate-300 px-1">Asignación</legend>
      {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm">
          {portalUserId ? (
            <span><span className="text-slate-500">Empleado (Core):</span> <span className="text-slate-200">{usuarioAsignado || portalUserId}</span></span>
          ) : terceroId ? (
            <span><span className="text-slate-500">Tercero externo:</span> <span className="text-slate-200">{usuarioAsignado}</span></span>
          ) : (
            <span className="text-slate-500">Sin asignar</span>
          )}
        </div>
        {(portalUserId || terceroId) && (
          <button type="button" disabled={busy} onClick={unassign} className="text-amber-400 hover:underline text-sm disabled:opacity-50">
            Quitar asignación
          </button>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-2 mt-3">
        <select className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Asignar a un tercero registrado…</option>
          {terceros.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}{t.organizacion ? ` (${t.organizacion})` : ''}</option>
          ))}
        </select>
        <button type="button" disabled={!selected || busy} onClick={assign} className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#2a1c05] font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
          {busy ? 'Asignando…' : 'Asignar'}
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        ¿No está en la lista? <Link to="/terceros" className="text-sky-400 hover:underline">Regístralo primero</Link>.
      </p>
    </fieldset>
  );
}

function ObservabilityPanel({ assetUid, data, error, onChange }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState('');
  const [linking, setLinking] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (data?.devices?.length === 0) {
      obsUnlinkedDevices().then(setAvailable).catch(() => setAvailable([]));
    }
  }, [data?.devices?.length]);

  async function linkDevice() {
    if (!selected || !assetUid) return;
    setLinking(true);
    setActionError('');
    try {
      await obsLinkDevice(selected, assetUid);
      await onChange();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLinking(false);
    }
  }

  async function unlinkDevice(deviceId) {
    setLinking(true);
    setActionError('');
    try {
      await obsLinkDevice(deviceId, null);
      await onChange();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLinking(false);
    }
  }

  return (
    <fieldset className="border border-slate-800 rounded-xl p-4">
      <legend className="text-sm font-semibold text-slate-300 px-1">MRTI Monitor · Estado operacional</legend>
      {error ? (
        <p className="text-sm text-amber-400">No fue posible consultar MRTI Monitor: {error}</p>
      ) : !data ? (
        <p className="text-sm text-slate-500">Consultando observabilidad…</p>
      ) : data.devices.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Este activo todavía no tiene un dispositivo monitoreado vinculado.</p>
          <div className="flex flex-col md:flex-row gap-2">
            <select className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm" value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Selecciona un dispositivo sin vincular…</option>
              {available.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.internal_id} · {device.name}{device.ip_address ? ` · ${device.ip_address}` : ''}
                </option>
              ))}
            </select>
            <button type="button" disabled={!selected || linking} onClick={linkDevice} className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#2a1c05] font-semibold px-4 py-2 rounded-lg">
              {linking ? 'Vinculando…' : 'Vincular con este activo'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.devices.map((device) => (
            <div key={device.id} className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-lg bg-slate-900 p-3 text-sm">
              <OperationalValue label="Dispositivo" value={`${device.name} (${device.internal_id})`} />
              <OperationalValue label="Estado" value={device.status_name || 'Sin estado'} />
              <OperationalValue label="IP" value={device.ip_address || '—'} />
              <OperationalValue label="Último ping" value={device.last_ping_at ? new Date(device.last_ping_at).toLocaleString() : 'Nunca'} />
              <button type="button" disabled={linking} onClick={() => unlinkDevice(device.id)} className="text-xs text-amber-400 hover:underline disabled:opacity-50">Desvincular monitoreo</button>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            {data.alerts.length} alerta{data.alerts.length === 1 ? '' : 's'} activa{data.alerts.length === 1 ? '' : 's'}.
            Los datos técnicos se administran en <a className="text-sky-400 hover:underline" href="/mrti-obs/">MRTI Monitor</a>.
          </p>
        </div>
      )}
      {actionError && <p className="mt-3 text-sm text-red-400">{actionError}</p>}
    </fieldset>
  );
}

const TICKET_OPEN_STATUSES = new Set(['NEW', 'OPEN', 'ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'REOPENED']);

function TicketsPanel({ assetUid, createTicketUrl }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!assetUid) return;
    setError('');
    ticketsFetch(assetUid).then(setTickets).catch((err) => setError(err.message));
  }, [assetUid]);

  if (!assetUid) return <p className="text-sm text-slate-500">Guarda el activo primero para poder relacionar tickets.</p>;
  if (error) return <p className="text-sm text-amber-400">No fue posible consultar MRTI Tickets: {error}</p>;
  if (!tickets) return <p className="text-sm text-slate-500">Consultando tickets…</p>;

  const open = tickets.filter((ticket) => TICKET_OPEN_STATUSES.includes(ticket.status_code));
  const closed = tickets.filter((ticket) => !TICKET_OPEN_STATUSES.includes(ticket.status_code));

  return (
    <fieldset className="border border-slate-800 rounded-xl p-4">
      <legend className="text-sm font-semibold text-slate-300 px-1">Tickets relacionados</legend>
      {createTicketUrl && <a href={createTicketUrl} className="mb-4 inline-block text-sm text-sky-400 hover:underline">+ Crear ticket para este activo</a>}
      <TicketGroup title="Abiertos" tickets={open} empty="Sin tickets abiertos." />
      <TicketGroup title="Cerrados" tickets={closed} empty="Sin tickets cerrados." className="mt-5" />
    </fieldset>
  );
}

function TicketGroup({ title, tickets, empty, className = '' }) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{title} ({tickets.length})</h3>
      {tickets.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <a key={ticket.id} href={`/tickets/${ticket.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 p-3 text-sm hover:bg-slate-800">
              <div className="min-w-0">
                <span className="font-medium text-slate-100">{ticket.folio}</span>
                <span className="ml-2 text-slate-400">{ticket.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                <span className={`priority priority-${(ticket.priority_code || '').toLowerCase()}`}>{ticket.priority_code}</span>
                <span>{ticket.status_name}</span>
                <span>{new Date(ticket.created_at).toLocaleDateString('es-MX')}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function OperationalValue({ label, value }) {
  return <div><span className="block text-xs text-slate-500">{label}</span><span className="text-slate-200">{value}</span></div>;
}

function Field({ field, value, onChange }) {
  const commonClass = 'w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100';
  const isWide = ['descripcion', 'software_incluido', 'version', 'esp_tec', 'notas'].includes(field.key);

  return (
    <label className={`block ${isWide ? 'md:col-span-2' : ''}`}>
      <span className="block text-xs text-slate-400 mb-1">
        {field.label}{field.required ? ' *' : ''}
      </span>
      {field.type === 'select' ? (
        <select className={commonClass} value={value ?? ''} onChange={(e) => onChange(field.key, e.target.value)}>
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea
          className={commonClass}
          rows={3}
          value={value ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : field.type === 'date' ? (
        <input
          type="date"
          className={commonClass}
          value={value ? String(value).slice(0, 10) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          className={commonClass}
          value={value ?? ''}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
    </label>
  );
}

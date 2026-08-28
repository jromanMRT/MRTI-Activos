import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, obsFetch, obsLinkDevice, obsUnlinkedDevices } from '../api.js';

export function AssetFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [observability, setObservability] = useState(null);
  const [observabilityError, setObservabilityError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/activos/meta'),
      mode === 'edit' ? apiFetch(`/activos/${id}`) : Promise.resolve({ data: {} }),
    ])
      .then(([meta, asset]) => {
        setGroups(meta.groups);
        setValues(asset.data || {});
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

  if (loading) return <p className="text-slate-500">Cargando…</p>;

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {mode === 'create' ? 'Nuevo activo' : `Activo ${values.center_code || ''}`}
        </h1>
        <div className="flex gap-2">
          {mode === 'edit' && (
            <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10">
              Retirar
            </button>
          )}
          <button type="submit" disabled={saving} className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#2a1c05] font-semibold px-4 py-2 rounded-lg">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="space-y-6">
        {groups.map((group) => (
          <fieldset key={group.key} className="border border-slate-800 rounded-xl p-4">
            <legend className="text-sm font-semibold text-slate-300 px-1">{group.label}</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              {group.fields.map((field) => (
                <Field key={field.key} field={field} value={values[field.key]} onChange={setField} />
              ))}
            </div>
          </fieldset>
        ))}
        {mode === 'edit' && (
          <AssignmentPanel
            assetId={id}
            portalUserId={values.portal_user_id}
            terceroId={values.tercero_id}
            usuarioAsignado={values.usuario_asignado}
            onChange={() => apiFetch(`/activos/${id}`).then((r) => setValues(r.data)).catch((err) => setError(err.message))}
          />
        )}
        {mode === 'edit' && (
          <ObservabilityPanel
            assetUid={values.asset_uid}
            data={observability}
            error={observabilityError}
            onChange={() => obsFetch(values.asset_uid).then(setObservability).catch((err) => setObservabilityError(err.message))}
          />
        )}
      </div>
    </form>
  );
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

function OperationalValue({ label, value }) {
  return <div><span className="block text-xs text-slate-500">{label}</span><span className="text-slate-200">{value}</span></div>;
}

function Field({ field, value, onChange }) {
  const commonClass = 'w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100';

  return (
    <label className="block">
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

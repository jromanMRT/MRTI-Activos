import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';

function dateText(value) {
  if (!value) return 'Sin registrar';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function dateRange(group, start, end) {
  if (!group[start]) return 'Sin registrar';
  if (group[start] === group[end]) return dateText(group[start]);
  return `${dateText(group[start])} – ${dateText(group[end])}`;
}

function Metric({ label, value, detail }) {
  return <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-sky-400">{value ?? '…'}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}

export function AntivirusLicensesPage() {
  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/activos-suite/antivirus-licenses')
      .then((response) => { setGroups(response.data || []); setMeta(response.meta || {}); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('es-MX');
    if (!search) return groups;
    return groups.filter((group) => [group.license_key, group.center_codes, group.date_status]
      .some((value) => String(value || '').toLocaleLowerCase('es-MX').includes(search)));
  }, [groups, query]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">Licenciamiento</p><h1 className="mt-1 text-2xl font-bold">Licencias antivirus</h1><p className="mt-1 max-w-3xl text-sm text-slate-400">Los equipos con la misma clave se agrupan automáticamente. La capacidad operativa inicial es de cinco dispositivos por licencia.</p></div>
      <Link to="/alertas?tipo=antivirus" className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/10">Ver vencimientos</Link>
    </div>
    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Licencias" value={meta?.licenses} detail="Claves distintas" />
      <Metric label="Dispositivos" value={meta?.devices} detail="Equipos con datos de antivirus" />
      <Metric label="Lugares disponibles" value={meta?.available_seats} detail="Tomando capacidad de 5" />
      <Metric label="Fechas por revisar" value={meta?.conflicts} detail="Compra o vencimiento distinto" />
      <Metric label="Sobre capacidad" value={meta?.over_capacity} detail="Más de 5 dispositivos" />
    </div>
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <label className="block text-sm text-slate-300">Buscar licencia o equipo<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej. MXBV… o TI-00123" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500" /></label>
    </section>
    <section className="overflow-hidden rounded-xl border border-slate-800">
      {loading ? <p className="p-5 text-sm text-slate-500">Cargando licencias…</p> : !visible.length ? <p className="p-5 text-sm text-slate-500">No hay licencias que coincidan.</p> : <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr><th className="px-4 py-3">Licencia</th><th className="px-4 py-3">Uso</th><th className="px-4 py-3">Compra</th><th className="px-4 py-3">Vencimiento</th><th className="px-4 py-3">Revisión</th><th className="px-4 py-3">Dispositivos vinculados</th></tr></thead><tbody>{visible.map((group) => <tr key={group.group_key} className="border-t border-slate-800 align-top"><td className="max-w-64 break-all px-4 py-3 font-medium text-slate-200">{group.license_key || <span className="text-amber-300">Sin clave</span>}</td><td className="whitespace-nowrap px-4 py-3"><span className={group.over_capacity ? 'font-semibold text-red-300' : 'text-slate-200'}>{group.device_count} / {group.capacity}</span><small className="mt-1 block text-slate-500">{group.available_seats} disponibles</small></td><td className="whitespace-nowrap px-4 py-3">{dateRange(group, 'fecha_adquisicion', 'fecha_adquisicion_hasta')}</td><td className="whitespace-nowrap px-4 py-3">{dateRange(group, 'fecha_vence', 'fecha_vence_hasta')}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs ${group.purchase_conflict || group.expiration_conflict ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{group.date_status}</span>{group.over_capacity && <span className="mt-2 block text-xs text-red-300">Capacidad excedida</span>}</td><td className="min-w-64 px-4 py-3"><div className="flex flex-wrap gap-2">{group.devices.map((device) => <Link key={device.id} to={`/${device.id}?tab=antivirus`} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-sky-300 hover:border-sky-500">{device.center_code || 'Sin código'}</Link>)}</div></td></tr>)}</tbody></table></div>}
    </section>
    <p className="text-xs text-slate-500">Cuando las fechas son distintas, la alerta toma el vencimiento más próximo y marca el grupo para revisión. No se reemplaza ningún dato automáticamente.</p>
  </div>;
}

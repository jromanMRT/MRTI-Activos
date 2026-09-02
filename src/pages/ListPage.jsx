import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

const EMPTY_STATS = { total: 0, activos: 0, mantenimiento: 0, inactivos: 0, baja: 0 };

export function ListPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [filters, setFilters] = useState({ tipos: [], estados: [], unidades: [], empresas: [] });
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [unidad, setUnidad] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sort, setSort] = useState('center_code');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      apiFetch('/activos/filtros').then(setFilters),
      apiFetch('/activos/stats').then((body) => setStats(body.data)),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (area) params.set('area', area);
    if (tipo) params.set('tipo', tipo);
    if (estado) params.set('estado', estado);
    if (unidad) params.set('unidad', unidad);
    if (empresa) params.set('empresa', empresa);
    params.set('sort', sort);
    params.set('order', order);
    setLoading(true);
    setError('');
    void apiFetch(`/activos?${params.toString()}`)
      .then((result) => setItems(result.data))
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [q, area, tipo, estado, unidad, empresa, sort, order]);

  function changeSort(nextSort) {
    if (sort === nextSort) {
      setOrder((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSort(nextSort);
    setOrder(['center_code', 'age', 'documents'].includes(nextSort) ? 'desc' : 'asc');
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen del inventario">
        <StatCard label="Total activos" value={stats.total} tone="neutral" />
        <StatCard label="Activos" value={stats.activos} tone="good" />
        <StatCard label="Mantenimiento" value={stats.mantenimiento} tone="warning" />
        <StatCard label="Inactivos" value={stats.inactivos} tone="neutral" />
        <StatCard label="Baja" value={stats.baja} tone="bad" />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-xl font-bold sm:text-2xl">Inventario de equipos</h1><p className="mt-1 text-sm text-slate-500">{items.length} resultado{items.length === 1 ? '' : 's'} en la vista actual</p></div>
          <Link to="/nuevo" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-[#2a1c05] shadow-sm hover:bg-sky-400">+ Nuevo activo</Link>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/35 p-3 sm:p-4">
          <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <input className="xl:col-span-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Buscar código, usuario, marca, serie…" value={q} onChange={(event) => setQ(event.target.value)} />
            <input className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm" placeholder="Área / departamento…" value={area} onChange={(event) => setArea(event.target.value)} />
            <Select label="Todos los tipos" value={tipo} onChange={setTipo} options={filters.tipos} />
            <Select label="Todos los estados" value={estado} onChange={setEstado} options={filters.estados} />
            <Select label="Todas las unidades" value={unidad} onChange={setUnidad} options={filters.unidades} />
            <div className="md:col-span-2 xl:col-span-2"><Select label="Todas las empresas" value={empresa} onChange={setEmpresa} options={filters.empresas} /></div>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-xs">
              <thead className="bg-slate-800/70 text-left uppercase tracking-wide text-slate-500">
                <tr>
                  <Th sortKey="center_code" sort={sort} order={order} onSort={changeSort}>Código TI</Th><Th sortKey="tipo" sort={sort} order={order} onSort={changeSort}>Tipo</Th><Th sortKey="brand" sort={sort} order={order} onSort={changeSort}>Marca / modelo</Th><Th sortKey="service" sort={sort} order={order} onSort={changeSort}>Service tag / serie</Th><Th sortKey="user" sort={sort} order={order} onSort={changeSort}>Usuario asignado</Th><Th sortKey="location" sort={sort} order={order} onSort={changeSort}>Unidad / área</Th><Th sortKey="company" sort={sort} order={order} onSort={changeSort}>Empresa</Th><Th sortKey="status" sort={sort} order={order} onSort={changeSort}>Estado</Th><Th sortKey="age" sort={sort} order={order} onSort={changeSort}>Antigüedad</Th><Th sortKey="documents" sort={sort} order={order} onSort={changeSort}>Docs</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Cargando inventario…</td></tr>
                  : items.length === 0 ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No hay equipos que coincidan con los filtros.</td></tr>
                    : items.map((item) => <AssetRow key={item.id} item={item} />)}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetRow({ item }) {
  const age = assetAge(item.fecha_compra);
  const navigate = useNavigate();
  const linkedToRh = Boolean(item.portal_user_id || item.tercero_id || item.rh_employee_id);
  return (
    <tr
      className="cursor-pointer border-t border-slate-800 align-top transition hover:bg-slate-900/75"
      onClick={() => navigate(`/${item.id}`)}
    >
      <td className="px-3 py-3.5"><span className="font-bold text-sky-400">{item.center_code}</span></td>
      <td className="px-3 py-3.5"><span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300">{item.tipo || '—'}</span></td>
      <td className="px-3 py-3.5"><strong className="block text-slate-100">{item.marca || '—'}</strong><span className="mt-0.5 block max-w-40 truncate text-slate-500" title={item.modelo || item.descripcion}>{item.modelo || item.descripcion || '—'}</span></td>
      <td className="px-3 py-3.5 font-mono"><span className="block text-slate-200">{item.service_tag || '—'}</span><span className="mt-0.5 block text-[10px] text-slate-500">{item.numero_serie || '—'}</span></td>
      <td className="px-3 py-3.5"><AssignmentBadge assigned={linkedToRh} /><span className="mt-1 block max-w-48 text-slate-100">{item.usuario_asignado || '—'}</span><span className="mt-0.5 block text-[10px] text-slate-500">ID: {item.id_empleado || '—'}</span></td>
      <td className="px-3 py-3.5"><span className="block text-slate-200">{item.unidad || '—'}</span><span className="mt-0.5 block max-w-36 truncate text-[10px] text-slate-500" title={item.area}>{item.area || '—'}</span></td>
      <td className="px-3 py-3.5"><span className="block max-w-48 text-slate-200">{item.empresa || '—'}</span></td>
      <td className="px-3 py-3.5"><EstadoBadge estado={item.estado} /></td>
      <td className="px-3 py-3.5"><strong className="block text-emerald-400">{age.label}</strong><span className="mt-0.5 block text-[10px] text-slate-500">{age.date}</span></td>
      <td className="px-3 py-3.5"><DocumentBadge item={item} /></td>
    </tr>
  );
}

function StatCard({ label, value, tone }) {
  const colors = { good: 'text-emerald-400', warning: 'text-amber-400', bad: 'text-red-400', neutral: 'text-slate-100' };
  return <article className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold ${colors[tone]}`}>{value}</p></article>;
}

function DocumentBadge({ item }) {
  const count = Number(item.documents_count || 0);
  if (!count) return <span className="text-slate-600">—</span>;
  return <Link to={`/${item.id}?tab=documentos`} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/25" title={`${count} documento${count === 1 ? '' : 's'} adjunto${count === 1 ? '' : 's'}`}><DocumentIcon />{count}</Link>;
}

function assetAge(value) {
  if (!value) return { label: '—', date: 'Sin fecha' };
  const date = new Date(value); if (Number.isNaN(date.getTime())) return { label: '—', date: 'Sin fecha' };
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  const years = Math.floor(days / 365); const months = Math.floor(days / 30);
  const label = years >= 1 ? `${years} año${years === 1 ? '' : 's'}` : months >= 1 ? `${months} mes${months === 1 ? '' : 'es'}` : `${days} día${days === 1 ? '' : 's'}`;
  return { label, date: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) };
}

function Th({ children, sortKey, sort, order, onSort }) {
  const active = sortKey && sort === sortKey;
  return <th className="whitespace-nowrap px-3 py-2.5 font-semibold" aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>{sortKey ? <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-slate-200 ${active ? 'text-sky-400' : ''}`}>{children}<span aria-hidden="true" className="text-[9px]">{active ? (order === 'asc' ? '▲' : '▼') : '⇅'}</span></button> : children}</th>;
}

function Select({ label, value, onChange, options }) {
  return <select className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

const ESTADO_STYLE = { Activo: 'bg-emerald-500/15 text-emerald-400', Inactivo: 'bg-slate-500/15 text-slate-400', 'En mantenimiento': 'bg-amber-500/15 text-amber-400', Baja: 'bg-red-500/15 text-red-400' };
function EstadoBadge({ estado }) { return estado ? <span className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold ${ESTADO_STYLE[estado] || 'bg-slate-500/15 text-slate-400'}`}>{estado}</span> : '—'; }
function AssignmentBadge({ assigned }) {
  return assigned
    ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Asignado</span>
    : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-semibold text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Sin asignar</span>;
}
function DocumentIcon() { return <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /></svg>; }

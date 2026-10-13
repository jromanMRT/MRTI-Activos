import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, rhAssetAssignmentProfilesFetch } from '../api.js';
import { openAssetRemission } from '../remissionPrint.js';
import { ASSET_CHANGED_EVENT } from '../assetEvents.js';
import { inventoryContext } from '../unitInventory.js';
import { DeleteAssetDialog } from '../components/DeleteAssetDialog.jsx';
import { Card } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { SelectNative } from '../components/ui/select-native.jsx';

function currentProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

const EMPTY_STATS = { total: 0, activos: 0, mantenimiento: 0, inactivos: 0, baja: 0 };

export function ListPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [filters, setFilters] = useState({ tipos: [], estados: [], unidades: [], empresas: [] });
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const unidad = searchParams.get('unidad_operativa') || '';
  const sinUnidad = searchParams.get('sin_unidad') === '1';
  function setUnidad(value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('sin_unidad'); next.delete('unidad_operativa');
      if (value) next.set('unidad_operativa', value);
      return next;
    });
  }
  const [empresa, setEmpresa] = useState('');
  const [sort, setSort] = useState('center_code');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeProfiles, setEmployeeProfiles] = useState({ byEmployeeId: {}, byPortalUserId: {} });
  const [inventoryRevision, setInventoryRevision] = useState(0);

  useEffect(() => {
    const refreshInventory = () => setInventoryRevision((current) => current + 1);
    window.addEventListener(ASSET_CHANGED_EVENT, refreshInventory);
    return () => window.removeEventListener(ASSET_CHANGED_EVENT, refreshInventory);
  }, []);

  useEffect(() => {
    void Promise.all([
      apiFetch('/activos/filtros').then(setFilters),
      apiFetch('/activos/stats').then((body) => setStats(body.data)),
    ]).catch(() => {});
  }, [inventoryRevision]);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (area) params.set('area', area);
    if (tipo) params.set('tipo', tipo);
    if (estado) params.set('estado', estado);
    if (sinUnidad) params.set('sin_unidad', '1');
    else if (unidad) params.set('unidad_operativa', unidad);
    if (empresa) params.set('empresa', empresa);
    params.set('sort', sort);
    params.set('order', order);
    setLoading(true);
    setError('');
    void apiFetch(`/activos?${params.toString()}`)
      .then((result) => { if (current) setItems(result.data); })
      .catch((requestError) => { if (current) setError(requestError.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [q, area, tipo, estado, unidad, sinUnidad, empresa, sort, order, inventoryRevision]);

  useEffect(() => {
    let current = true;
    const references = items.flatMap((item) => item.rh_employee_id
      ? [{ employee_id: item.rh_employee_id }]
      : item.portal_user_id ? [{ portal_user_id: item.portal_user_id }] : []);
    if (!references.length) {
      setEmployeeProfiles({ byEmployeeId: {}, byPortalUserId: {} });
      return () => { current = false; };
    }
    rhAssetAssignmentProfilesFetch(references).then((profiles) => {
      if (!current) return;
      setEmployeeProfiles({
        byEmployeeId: Object.fromEntries(profiles.map((profile) => [String(profile.id), profile])),
        byPortalUserId: Object.fromEntries(profiles.filter((profile) => profile.portal_user_id).map((profile) => [profile.portal_user_id, profile])),
      });
    }).catch(() => {
      if (current) setEmployeeProfiles({ byEmployeeId: {}, byPortalUserId: {} });
    });
    return () => { current = false; };
  }, [items]);

  function changeSort(nextSort) {
    if (sort === nextSort) {
      setOrder((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSort(nextSort);
    setOrder(['center_code', 'age', 'documents'].includes(nextSort) ? 'desc' : 'asc');
  }

  return (
    <div className="page-fade-in space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen del inventario">
        <StatCard label="Total activos" value={stats.total} tone="neutral" />
        <StatCard label="Activos" value={stats.activos} tone="good" />
        <StatCard label="Mantenimiento" value={stats.mantenimiento} tone="warning" />
        <StatCard label="Inactivos" value={stats.inactivos} tone="neutral" />
        <StatCard label="Baja" value={stats.baja} tone="bad" />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-xl font-bold sm:text-2xl">Inventario de equipos</h1><p className="mt-1 text-sm text-stone-500">{items.length} resultado{items.length === 1 ? '' : 's'} en la vista actual</p></div>
          <div className="flex flex-wrap gap-3"><Button variant="secondary" size="sm" asChild><Link to="/inventario/unidades">Inventario por unidad</Link></Button><Button size="sm" asChild><Link to="/nuevo">+ Nuevo activo</Link></Button></div>
        </div>

        <div className="rounded-xl border border-stone-700 bg-stone-800/35 p-3 sm:p-4">
          {(unidad || sinUnidad) && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm"><span>Unidad: <strong>{sinUnidad ? 'Sin unidad registrada' : unidad}</strong></span><Button variant="link" size="sm" onClick={() => setUnidad('')}>Quitar filtro de unidad</Button><Button variant="link" size="sm" asChild><Link to="/inventario/unidades">Volver al resumen por unidad</Link></Button></div>}
          <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <Input className="xl:col-span-2" placeholder="Buscar código, usuario, marca, serie…" value={q} onChange={(event) => setQ(event.target.value)} />
            <Input placeholder="Área / departamento…" value={area} onChange={(event) => setArea(event.target.value)} />
            <FilterSelect label="Todos los tipos" value={tipo} onChange={setTipo} options={filters.tipos} />
            <FilterSelect label="Todos los estados" value={estado} onChange={setEstado} options={filters.estados} />
            <FilterSelect label={sinUnidad ? 'Sin unidad registrada' : 'Todas las unidades'} value={unidad} onChange={setUnidad} options={[...new Set([...(unidad ? [unidad] : []), ...filters.unidades.map((name) => name.trim()).filter(Boolean)])]} />
            <div className="md:col-span-2 xl:col-span-2"><FilterSelect label="Todas las empresas" value={empresa} onChange={setEmpresa} options={filters.empresas} /></div>
          </div>

          {error && <div className="mb-4 rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 px-4 py-3 text-mrt-bad-light">{error}</div>}

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-xs">
              <thead className="bg-stone-700/70 text-left uppercase tracking-wide text-stone-500">
                <tr>
                  <Th sortKey="center_code" sort={sort} order={order} onSort={changeSort}>Código TI</Th><Th sortKey="tipo" sort={sort} order={order} onSort={changeSort}>Tipo</Th><Th sortKey="brand" sort={sort} order={order} onSort={changeSort}>Marca / modelo</Th><Th sortKey="service" sort={sort} order={order} onSort={changeSort}>Service tag / serie</Th><Th sortKey="user" sort={sort} order={order} onSort={changeSort}>Usuario asignado</Th><Th sortKey="location" sort={sort} order={order} onSort={changeSort}>Unidad / área</Th><Th sortKey="company" sort={sort} order={order} onSort={changeSort}>Empresa</Th><Th sortKey="status" sort={sort} order={order} onSort={changeSort}>Estado</Th><Th sortKey="age" sort={sort} order={order} onSort={changeSort}>Antigüedad</Th><Th sortKey="documents" sort={sort} order={order} onSort={changeSort}>Docs</Th><Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={11} className="px-4 py-12 text-center text-stone-500">Cargando inventario…</td></tr>
                  : items.length === 0 ? <tr><td colSpan={11} className="px-4 py-12 text-center text-stone-500">No hay equipos que coincidan con los filtros.</td></tr>
                    : items.map((item) => <AssetRow key={item.id} item={item} employeeProfile={
                      (item.rh_employee_id && employeeProfiles.byEmployeeId[String(item.rh_employee_id)])
                      || (item.portal_user_id && employeeProfiles.byPortalUserId[item.portal_user_id])
                      || null
                    } />)}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetRow({ item, employeeProfile }) {
  const age = assetAge(item.fecha_compra);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const context = inventoryContext(searchParams);
  const linkedToRh = Boolean(item.portal_user_id || item.tercero_id || item.rh_employee_id);
  const inheritedEmployeeId = item.id_empleado && item.id_empleado !== '-' ? item.id_empleado : null;
  const employeeNumber = employeeProfile?.employee_number || inheritedEmployeeId;
  const isAdministrator = String(currentProfile().role || '').toLowerCase() === 'administrator';
  const [deleteOpen, setDeleteOpen] = useState(false);
  async function printRemission(event) {
    event.stopPropagation();
    try {
      await openAssetRemission({ assetId: item.id, employeeProfile });
    } catch (printError) {
      window.alert(printError.message);
    }
  }
  return (
    <tr
      className="cursor-pointer border-t border-stone-700 align-top transition hover:bg-stone-800/75 even:bg-stone-800/30"
      onClick={() => navigate(`/${item.id}${context ? `?${context}` : ''}`)}
    >
      <td className="px-3 py-3.5"><span className="font-bold text-ore-300">{item.center_code}</span></td>
      <td className="px-3 py-3.5"><span className="rounded bg-stone-700 px-2 py-1 text-[10px] font-medium text-stone-300">{item.tipo || '—'}</span></td>
      <td className="px-3 py-3.5"><strong className="block text-stone-100">{item.marca || '—'}</strong><span className="mt-0.5 block max-w-40 truncate text-stone-500" title={item.modelo || item.descripcion}>{item.modelo || item.descripcion || '—'}</span></td>
      <td className="px-3 py-3.5 font-mono"><span className="block text-stone-200">{item.service_tag || '—'}</span><span className="mt-0.5 block text-[10px] text-stone-500">{item.numero_serie || '—'}</span></td>
      <td className="px-3 py-3.5"><AssignmentBadge assigned={linkedToRh} /><span className="mt-1 block max-w-48 text-stone-100">{employeeProfile?.full_name || item.usuario_asignado || '—'}</span><span className="mt-0.5 block text-[10px] text-stone-500">ID: {employeeNumber || '—'}</span></td>
      <td className="px-3 py-3.5"><span className="block text-stone-200">{item.unidad || '—'}</span><span className="mt-0.5 block max-w-36 truncate text-[10px] text-stone-500" title={employeeProfile?.area_name || item.area}>{employeeProfile?.area_name || item.area || '—'}</span></td>
      <td className="px-3 py-3.5"><span className="block max-w-48 text-stone-200">{employeeProfile?.company_name || item.empresa || '—'}</span></td>
      <td className="px-3 py-3.5"><EstadoBadge estado={item.estado} /></td>
      <td className="px-3 py-3.5"><strong className="block text-mrt-good-light">{age.label}</strong><span className="mt-0.5 block text-[10px] text-stone-500">{age.date}</span></td>
      <td className="px-3 py-3.5"><DocumentBadge item={item} /></td>
      <td className="px-3 py-3.5"><Button variant="secondary" size="sm" onClick={printRemission} className="gap-1.5 text-[10px] text-ore-300" title={`Imprimir remisión de ${item.center_code}`} aria-label={`Imprimir remisión de ${item.center_code}`}><PrintIcon />Imprimir</Button>{isAdministrator && <Button variant="destructive" size="sm" onClick={(event) => { event.stopPropagation(); setDeleteOpen(true); }} className="mt-1.5 block text-[10px]" title={`Eliminar ${item.center_code}`} aria-label={`Eliminar ${item.center_code}`}>Eliminar</Button>}{deleteOpen && <DeleteAssetDialog asset={item} onClose={() => setDeleteOpen(false)} onDeleted={() => setDeleteOpen(false)} />}</td>
    </tr>
  );
}

function StatCard({ label, value, tone }) {
  const colors = { good: 'text-mrt-good-light', warning: 'text-mrt-warn-light', bad: 'text-mrt-bad-light', neutral: 'text-stone-100' };
  return <Card className="border-stone-700 bg-stone-800/60 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">{label}</p><p className={`mt-2 text-3xl font-bold ${colors[tone]}`}>{value}</p></Card>;
}

function DocumentBadge({ item }) {
  const [searchParams] = useSearchParams();
  const context = inventoryContext(searchParams);
  const count = Number(item.documents_count || 0);
  if (!count) return <span className="text-stone-600">—</span>;
  return <Link to={`/${item.id}?tab=documentos${context ? `&${context}` : ''}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-mrt-good/15 px-2 py-1 text-[10px] font-bold text-mrt-good-light hover:bg-mrt-good/25" title={`${count} documento${count === 1 ? '' : 's'} adjunto${count === 1 ? '' : 's'}`} aria-label={`Abrir ${count} documento${count === 1 ? '' : 's'} de ${item.center_code}`}><DocumentIcon />{count}</Link>;
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
  return <th className="whitespace-nowrap px-3 py-2.5 font-semibold" aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>{sortKey ? <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 hover:text-stone-200 ${active ? 'text-ore-300' : ''}`}>{children}<span aria-hidden="true" className="text-[9px]">{active ? (order === 'asc' ? '▲' : '▼') : '⇅'}</span></button> : children}</th>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <SelectNative value={value} onChange={(event) => onChange(event.target.value)}><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</SelectNative>;
}

const ESTADO_VARIANT = { Activo: 'success', Inactivo: 'default', 'En mantenimiento': 'warning', Baja: 'danger' };
function EstadoBadge({ estado }) { return estado ? <Badge variant={ESTADO_VARIANT[estado] || 'default'}>{estado}</Badge> : '—'; }
function AssignmentBadge({ assigned }) {
  return assigned
    ? <Badge variant="success"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-mrt-good-light" />Asignado</Badge>
    : <Badge variant="warning"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-mrt-warn-light" />Sin asignar</Badge>;
}
function DocumentIcon() { return <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /></svg>; }
function PrintIcon() { return <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>; }

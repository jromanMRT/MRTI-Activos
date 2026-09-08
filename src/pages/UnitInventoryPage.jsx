import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { ASSET_CHANGED_EVENT } from '../assetEvents.js';
import { unitCatalogStatus, unitInventoryHref } from '../unitInventory.js';

export function UnitInventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('used');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(ASSET_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(ASSET_CHANGED_EVENT, refresh);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    apiFetch('/activos-suite/unit-inventory')
      .then((body) => { if (current) setRows(body.data); })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [revision]);
  const missing = rows.find((row) => row.nombre === null)?.total || 0;
  const outside = rows.filter((row) => row.nombre !== null && !row.registros);
  const visible = rows.filter((row) => {
    if (!(row.nombre || 'Sin unidad registrada').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))) return false;
    if (scope === 'used') return row.total > 0;
    if (scope === 'empty') return row.total === 0;
    if (scope === 'review') return row.nombre === null || !row.registros || !row.vigentes || row.registros > 1;
    return true;
  });
  const stats = [
    ['Equipos en inventario', rows.reduce((sum, row) => sum + row.total, 0)],
    ['Unidades con equipos', rows.filter((row) => row.nombre !== null && row.total > 0).length],
    ['Equipos sin unidad', missing],
    ['Nombres fuera del catálogo', outside.length],
  ];
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><Link to="/inventario" className="text-sm text-sky-400 hover:underline">← Inventario</Link><h1 className="mt-2 text-2xl font-bold">Inventario por unidad</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">Consulta los equipos agrupados por la unidad registrada en el inventario y revisa su coincidencia con el catálogo.</p></div>
      <div className="flex gap-3"><button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm disabled:opacity-50">Actualizar</button><Link to="/catalogos/unidades" className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Administrar catálogo</Link></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}
    {loading ? <p role="status" className="py-10 text-center text-slate-400">Cargando unidades e inventario…</p> : !error && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, count]) => <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></div>)}</div>
      <p className="rounded-xl border border-slate-800 p-4 text-sm text-slate-400">Se conservan etiquetas históricas como “Dañada”, “DONADA” o “Sin Asignar”. Los estados y las asignaciones se cuentan desde la ficha del equipo; el nombre de la unidad no los determina. La unidad laboral del responsable se consulta en RH.</p>
      <div className="flex flex-wrap gap-3"><input aria-label="Buscar unidad" placeholder="Buscar unidad…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm" /><select aria-label="Mostrar unidades" value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"><option value="used">Con equipos</option><option value="all">Todas</option><option value="empty">Sin equipos</option><option value="review">Por revisar</option></select></div>
      <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full text-sm"><thead className="bg-slate-900 text-left text-slate-400"><tr>{['Unidad registrada', 'Total', 'Activos', 'Mantenimiento', 'Bajas', 'Con asignación', 'Catálogo', 'Consultar'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.nombre === null ? 'missing' : `unit:${row.nombre}`} className="border-t border-slate-800 hover:bg-slate-900/50"><td className="px-4 py-3 font-medium">{row.nombre ?? 'Sin unidad registrada'}</td>{['total', 'activos', 'mantenimiento', 'bajas', 'asignados'].map((key) => <td key={key} className="px-4 py-3">{row[key]}</td>)}<td className="px-4 py-3 text-slate-400">{unitCatalogStatus(row)}</td><td className="whitespace-nowrap px-4 py-3">{row.total > 0 ? <Link to={unitInventoryHref(row.nombre)} className="text-sky-400 hover:underline" aria-label={`Ver equipos de ${row.nombre ?? 'Sin unidad registrada'}`}>Ver equipos →</Link> : <span className="text-slate-500">Sin equipos</span>}</td></tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No hay unidades que coincidan con los filtros.</td></tr>}</tbody></table></div>
      <p className="text-xs text-slate-500">Los totales incluyen todos los estados. “Con asignación” indica un vínculo registrado a una persona y puede incluir equipos en mantenimiento o dados de baja.</p>
    </>}
  </div>;
}

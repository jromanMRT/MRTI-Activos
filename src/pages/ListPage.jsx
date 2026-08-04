import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';

export function ListPage() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ tipos: [], estados: [], unidades: [], empresas: [] });
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [unidad, setUnidad] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/activos/filtros').then(setFilters).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tipo) params.set('tipo', tipo);
    if (estado) params.set('estado', estado);
    if (unidad) params.set('unidad', unidad);
    if (empresa) params.set('empresa', empresa);
    setLoading(true);
    apiFetch(`/activos?${params.toString()}`)
      .then((result) => setItems(result.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [q, tipo, estado, unidad, empresa]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventario de activos</h1>
          <p className="text-slate-400 text-sm mt-1">{items.length} equipo{items.length === 1 ? '' : 's'}</p>
        </div>
        <Link to="/nuevo" className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg">
          + Nuevo activo
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <input
          className="col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar por usuario, serie, modelo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select label="Tipo" value={tipo} onChange={setTipo} options={filters.tipos} />
        <Select label="Estado" value={estado} onChange={setEstado} options={filters.estados} />
        <Select label="Unidad" value={unidad} onChange={setUnidad} options={filters.unidades} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Select label="Empresa" value={empresa} onChange={setEmpresa} options={filters.empresas} />
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 mb-4">{error}</div>}

      <div className="border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <Th>Centro</Th><Th>Tipo</Th><Th>Descripción</Th><Th>Usuario asignado</Th>
              <Th>Unidad</Th><Th>Empresa</Th><Th>Estado</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Sin resultados</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900/60">
                  <td className="px-4 py-2">
                    <Link to={`/${item.id}`} className="text-sky-400 hover:underline">{item.center_code}</Link>
                  </td>
                  <td className="px-4 py-2">{item.tipo || '—'}</td>
                  <td className="px-4 py-2 max-w-xs truncate" title={item.descripcion}>{item.descripcion || '—'}</td>
                  <td className="px-4 py-2">{item.usuario_asignado || '—'}</td>
                  <td className="px-4 py-2">{item.unidad || '—'}</td>
                  <td className="px-4 py-2">{item.empresa || '—'}</td>
                  <td className="px-4 py-2"><EstadoBadge estado={item.estado} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }) {
  return <th className="px-4 py-2 font-medium">{children}</th>;
}

function Select({ label, value, onChange, options }) {
  return (
    <select
      className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}: todos</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

const ESTADO_STYLE = {
  Activo: 'bg-emerald-500/15 text-emerald-400',
  Inactivo: 'bg-slate-500/15 text-slate-400',
  'En mantenimiento': 'bg-amber-500/15 text-amber-400',
};

function EstadoBadge({ estado }) {
  if (!estado) return '—';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLE[estado] || 'bg-slate-500/15 text-slate-400'}`}>
      {estado}
    </span>
  );
}

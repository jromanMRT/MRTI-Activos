import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

function emptyForm() {
  return { nombre: '', organizacion: '', motivo: '', telefono: '', correo: '', notas: '' };
}

export function TercerosPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (showInactive) params.set('estado', 'todos');
    apiFetch(`/terceros?${params.toString()}`)
      .then((r) => setItems(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [q, showInactive]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/terceros', { method: 'POST', body: JSON.stringify(form) });
      setForm(emptyForm());
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEstado(item) {
    try {
      await apiFetch(`/terceros/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: item.estado === 'Inactivo' ? 'Activo' : 'Inactivo' }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Terceros externos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Contratistas, proveedores o visitas que pueden tener un equipo asignado sin ser empleados ni usuarios de la plataforma.
          </p>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 mb-4">{error}</div>}

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 border border-slate-800 bg-slate-900/30 rounded-xl p-4">
        <input
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Nombre completo"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Organización / empresa (opcional)"
          value={form.organizacion}
          onChange={(e) => setForm({ ...form, organizacion: e.target.value })}
        />
        <input
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Motivo (contratista, proveedor, visita…)"
          value={form.motivo}
          onChange={(e) => setForm({ ...form, motivo: e.target.value })}
        />
        <input
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Teléfono (opcional)"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
        <input
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Correo (opcional)"
          type="email"
          value={form.correo}
          onChange={(e) => setForm({ ...form, correo: e.target.value })}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            placeholder="Notas (opcional)"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
          <button disabled={saving} className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-[#2a1c05] font-semibold px-4 py-2 rounded-lg whitespace-nowrap">
            + Registrar
          </button>
        </div>
      </form>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <input
          className="col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar por nombre, organización o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-400 px-2">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nombre</th>
              <th className="px-4 py-2 font-medium">Organización</th>
              <th className="px-4 py-2 font-medium">Motivo</th>
              <th className="px-4 py-2 font-medium">Contacto</th>
              <th className="px-4 py-2 font-medium">Estatus</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sin terceros registrados</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900/60">
                  <td className="px-4 py-2 font-medium">{item.nombre}</td>
                  <td className="px-4 py-2">{item.organizacion || '—'}</td>
                  <td className="px-4 py-2">{item.motivo || '—'}</td>
                  <td className="px-4 py-2 text-slate-400">{[item.telefono, item.correo].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.estado === 'Inactivo' ? 'bg-slate-500/15 text-slate-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                      {item.estado === 'Inactivo' ? 'Inactivo' : 'Activo'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => toggleEstado(item)} className="text-sky-400 hover:underline text-sm">
                      {item.estado === 'Inactivo' ? 'Reactivar' : 'Desactivar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

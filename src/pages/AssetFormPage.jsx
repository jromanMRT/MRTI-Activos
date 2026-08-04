import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api.js';

export function AssetFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/activos/meta'),
      mode === 'edit' ? apiFetch(`/activos/${id}`) : Promise.resolve({ data: {} }),
    ])
      .then(([meta, asset]) => {
        setGroups(meta.groups);
        setValues(asset.data || {});
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
    if (!window.confirm('¿Eliminar este activo? Esta acción no se puede deshacer.')) return;
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
              Eliminar
            </button>
          )}
          <button type="submit" disabled={saving} className="bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-lg">
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
      </div>
    </form>
  );
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

import { useEffect, useState } from 'react';
import { apiFetch, rhAssetAssignmentProfilesFetch } from '../api.js';
import { assignmentPerson, assignmentReference } from '../assignmentHistory.js';

function date(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : parsed.toLocaleString('es-MX');
}

export function AssignmentHistory({ assetId, revision }) {
  const [rows, setRows] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setRows(null); setProfiles([]); setError(''); setWarning('');
    (async () => {
      try {
        const { data } = await apiFetch(`/activos/${assetId}/asignaciones`);
        if (!active) return;
        setRows(data);
        const references = [...new Map(data.map(assignmentReference).filter(Boolean).map(r => [JSON.stringify(r), r])).values()];
        const people = [];
        try {
          for (let i = 0; i < references.length; i += 1000) {
            people.push(...await rhAssetAssignmentProfilesFetch(references.slice(i, i + 1000)));
          }
          if (active) setProfiles(people);
        } catch {
          if (active) setWarning('No se pudieron consultar los nombres en RH. El historial conserva las referencias y fechas registradas.');
        }
      } catch (err) { if (active) setError(err.message); }
    })();
    return () => { active = false; };
  }, [assetId, revision, retry]);
  return <section className="mt-6 border-t border-slate-800 pt-4" aria-label="Historial de asignaciones">
    <h3 className="text-sm font-semibold text-slate-200">Historial de asignaciones</h3>
    <p className="mt-1 text-xs text-slate-500">Personas que han tenido este activo, según los movimientos registrados. Los nombres se consultan en RH.</p>
    {error ? <div role="alert" className="mt-3 text-sm text-red-400">{error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Reintentar</button></div>
      : rows === null ? <p className="mt-3 text-sm text-slate-500">Consultando historial…</p>
      : rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay movimientos de asignación registrados.</p>
      : <ol className="mt-3 space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg border border-slate-800 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="min-w-0 break-words text-slate-200">{assignmentPerson(row, profiles)}</strong><span className="text-xs text-slate-500">{row.unassigned_at ? 'Finalizada' : 'Vigente'}</span></div>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">Asignado desde</dt><dd>{date(row.assigned_at)}</dd></div><div><dt className="text-slate-500">Fin de asignación</dt><dd>{row.unassigned_at ? date(row.unassigned_at) : 'Asignación abierta'}</dd></div></dl>
        {row.notes && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-400">{row.notes}</p>}
      </li>)}</ol>}
    {warning && <p role="status" className="mt-3 text-xs text-amber-400">{warning}</p>}
  </section>;
}

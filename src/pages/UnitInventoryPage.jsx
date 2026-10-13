import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import { ASSET_CHANGED_EVENT } from '../assetEvents.js';
import { unitCatalogStatus, unitInventoryHref } from '../unitInventory.js';
import { Card } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { SelectNative } from '../components/ui/select-native.jsx';
import { Textarea } from '../components/ui/textarea.jsx';

function currentProfile() {
  try { return JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { return {}; }
}

export function UnitInventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('used');
  const [revision, setRevision] = useState(0);
  const isAdministrator = String(currentProfile().role || '').toLowerCase() === 'administrator';
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
      <div><Link to="/inventario" className="text-sm text-ore-300 hover:underline">← Inventario</Link><h1 className="mt-2 text-2xl font-bold">Inventario por unidad</h1><p className="mt-2 max-w-3xl text-sm text-stone-400">Consulta los equipos agrupados por la unidad registrada en el inventario y revisa su coincidencia con el catálogo.</p></div>
      <div className="flex gap-3"><Button variant="secondary" size="sm" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Actualizar</Button><Button variant="secondary" size="sm" asChild><Link to="/catalogos/unidades">Administrar catálogo</Link></Button></div>
    </header>
    {error && <div role="alert" className="rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 p-4 text-mrt-bad-light">{error}</div>}
    {loading ? <p role="status" className="py-10 text-center text-stone-400">Cargando unidades e inventario…</p> : !error && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, count]) => <Card key={label} className="border-stone-700 bg-stone-800/40 p-4"><p className="text-sm text-stone-400">{label}</p><p className="mt-2 text-3xl font-bold">{count}</p></Card>)}</div>
      <p className="rounded-xl border border-stone-700 p-4 text-sm text-stone-400">Se conservan etiquetas históricas como “Dañada”, “DONADA” o “Sin Asignar”. Los estados y las asignaciones se cuentan desde la ficha del equipo; el nombre de la unidad no los determina. La unidad laboral del responsable se consulta en RH.</p>
      <div className="flex flex-wrap gap-3"><Input aria-label="Buscar unidad" placeholder="Buscar unidad…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1" /><SelectNative aria-label="Mostrar unidades" value={scope} onChange={(event) => setScope(event.target.value)} className="w-auto"><option value="used">Con equipos</option><option value="all">Todas</option><option value="empty">Sin equipos</option><option value="review">Por revisar</option></SelectNative></div>
      {scope === 'review' ? (
        <UnitReviewQueue query={query} isAdministrator={isAdministrator} revision={revision} onChanged={() => setRevision((value) => value + 1)} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-stone-700"><table className="min-w-full text-sm"><thead className="bg-stone-800 text-left text-stone-400"><tr>{['Unidad registrada', 'Total', 'Activos', 'Mantenimiento', 'Bajas', 'Con asignación', 'Catálogo', 'Consultar'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visible.map((row) => <tr key={row.nombre === null ? 'missing' : `unit:${row.nombre}`} className="border-t border-stone-700 hover:bg-stone-800/50 even:bg-stone-800/30"><td className="px-4 py-3 font-medium">{row.nombre ?? 'Sin unidad registrada'}</td>{['total', 'activos', 'mantenimiento', 'bajas', 'asignados'].map((key) => <td key={key} className="px-4 py-3">{row[key]}</td>)}<td className="px-4 py-3 text-stone-400">{unitCatalogStatus(row)}</td><td className="whitespace-nowrap px-4 py-3">{row.total > 0 ? <Link to={unitInventoryHref(row.nombre)} className="text-ore-300 hover:underline" aria-label={`Ver equipos de ${row.nombre ?? 'Sin unidad registrada'}`}>Ver equipos →</Link> : <span className="text-stone-500">Sin equipos</span>}</td></tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center text-stone-400">No hay unidades que coincidan con los filtros.</td></tr>}</tbody></table></div>
          <p className="text-xs text-stone-500">Los totales incluyen todos los estados. “Con asignación” indica un vínculo registrado a una persona y puede incluir equipos en mantenimiento o dados de baja.</p>
        </>
      )}
    </>}
  </div>;
}

const USAGE_KIND_LABELS = {
  pending: 'Sin clasificar', inventory: 'Sólo inventario (sin ubicación/organización)', physical: 'Ubicación física',
  organizational: 'Organización laboral', legacy: 'Etiqueta histórica (se conserva)', obsolete: 'Obsoleta',
};

// Bandeja accionable: a diferencia de "used/all/empty" (que sólo filtran la
// misma proyección de sólo lectura), esta pestaña trae los motivos desde el
// servidor (unitReviewQueue.js) y permite clasificar/corregir/archivar sin
// salir de la vista. No decide nada por su cuenta: cada acción exige un
// motivo y la referencia se valida contra el módulo dueño al guardar.
function UnitReviewQueue({ query, isAdministrator, revision, onChanged }) {
  const [queue, setQueue] = useState(null);
  const [meta, setMeta] = useState({ reason_labels: {}, usage_kinds: [] });
  const [error, setError] = useState('');

  function refresh() {
    apiFetch('/activos-suite/unit-review/queue')
      .then((result) => { setQueue(result.data || []); setMeta({ reason_labels: result.reason_labels || {}, usage_kinds: result.usage_kinds || [] }); })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { refresh(); }, [revision]);

  const visible = (queue || []).filter((row) => (row.nombre || 'Sin unidad registrada').toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));

  if (error) return <div role="alert" className="rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 p-4 text-mrt-bad-light">{error}</div>;
  if (queue === null) return <p role="status" className="py-10 text-center text-stone-400">Consultando bandeja de revisión…</p>;
  if (!visible.length) return <p className="rounded-xl border border-stone-700 p-8 text-center text-stone-400">No hay unidades pendientes de revisión con este filtro.</p>;

  return (
    <div className="space-y-3">
      {visible.map((row) => (
        <article key={row.nombre === null ? 'missing' : `review:${row.nombre}`} className="rounded-xl border border-stone-700 bg-stone-800/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-stone-100">{row.nombre ?? 'Sin unidad registrada'}</h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {row.reasons.map((reason) => <span key={reason} className="rounded-full bg-mrt-warn/15 px-2 py-0.5 text-[11px] text-mrt-warn-light">{meta.reason_labels[reason] || reason}</span>)}
              </div>
              <p className="mt-2 text-xs text-stone-500">{row.total} equipo(s) · {row.activos} activo(s) · {row.asignados} con asignación</p>
            </div>
            {row.total > 0 && <Link to={unitInventoryHref(row.nombre)} className="whitespace-nowrap text-sm text-ore-300 hover:underline" aria-label={`Ver equipos de ${row.nombre ?? 'Sin unidad registrada'}`}>Ver equipos →</Link>}
          </div>
          {row.catalog.length === 0 ? (
            <p className="mt-3 rounded-lg border border-stone-700 bg-stone-900/50 p-3 text-xs text-stone-500">Este nombre no existe en el catálogo de unidades. Antes de clasificarlo hay que decidir si se registra como unidad nueva o si los equipos deben corregirse a un nombre del catálogo -- esa decisión no se toma automáticamente aquí.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {row.catalog.map((entry) => (
                <CatalogEntryRow key={entry.id} entry={entry} usageKinds={meta.usage_kinds} isAdministrator={isAdministrator} unitName={row.nombre} unitTotal={row.total} onChanged={() => { refresh(); onChanged?.(); }} />
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function CatalogEntryRow({ entry, usageKinds, isAdministrator, unitName, unitTotal, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [usageKind, setUsageKind] = useState(entry.usage_kind || 'pending');
  const [referenceId, setReferenceId] = useState(entry.reference_id || '');
  const [reviewNote, setReviewNote] = useState('');
  const [references, setReferences] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing || !['physical', 'organizational'].includes(usageKind)) return;
    setReferences(null);
    const path = usageKind === 'physical' ? '/activos-suite/unit-review/references/physical-areas' : '/activos-suite/unit-review/references/org-units';
    apiFetch(path).then((result) => setReferences(result.data || [])).catch((err) => setError(err.message));
  }, [editing, usageKind]);

  async function save() {
    setSaving(true); setError('');
    try {
      await apiFetch(`/activos-suite/unit-review/catalog/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          usage_kind: usageKind,
          reference_id: ['physical', 'organizational'].includes(usageKind) ? referenceId : null,
          review_note: reviewNote,
          revision: entry.review_revision,
        }),
      });
      setEditing(false); setReviewNote('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    const note = window.prompt(`Motivo y evidencia para archivar "${unitName}" (no elimina equipos, sólo el nombre del catálogo):`);
    if (note === null) return;
    setSaving(true); setError('');
    try {
      await apiFetch(`/activos-suite/resources/unidades/${entry.id}/archive`, { method: 'PATCH', body: JSON.stringify({ review_note: note }) });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-stone-300">{USAGE_KIND_LABELS[entry.usage_kind] || entry.usage_kind}</span>
          {entry.archived_at && <span className="ml-2 rounded-full bg-stone-700 px-2 py-0.5 text-[10px] text-stone-400">Archivada</span>}
          {entry.reference_id && <span className="ml-2 text-xs text-stone-500">ref. {entry.reference_id}</span>}
        </div>
        {isAdministrator && !entry.archived_at && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing((value) => !value)} className="text-xs text-ore-300 hover:underline">{editing ? 'Cancelar' : 'Clasificar'}</button>
            <button type="button" disabled={saving} onClick={archive} className="text-xs text-mrt-bad-light hover:underline disabled:opacity-50">Archivar</button>
          </div>
        )}
      </div>
      {entry.review_note && <p className="mt-1 text-xs text-stone-500">Nota: {entry.review_note}</p>}
      {error && <p className="mt-2 text-xs text-mrt-bad-light">{error}</p>}
      {editing && (
        <div className="mt-3 space-y-2 border-t border-stone-700 pt-3">
          <SelectNative value={usageKind} onChange={(event) => setUsageKind(event.target.value)}>
            {usageKinds.map((kind) => <option key={kind} value={kind}>{USAGE_KIND_LABELS[kind] || kind}</option>)}
          </SelectNative>
          {['physical', 'organizational'].includes(usageKind) && (
            references === null ? <p className="text-xs text-stone-500">Consultando referencias vigentes…</p> : (
              <SelectNative value={referenceId} onChange={(event) => setReferenceId(event.target.value)}>
                <option value="">Selecciona una referencia vigente…</option>
                {references.map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {usageKind === 'physical' ? [reference.site_name, reference.building_name, reference.floor_name, reference.name].filter(Boolean).join(' / ') : reference.name}
                  </option>
                ))}
              </SelectNative>
            )
          )}
          <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Motivo y evidencia de la clasificación (mínimo 8 caracteres)…" rows={2} />
          <Button size="sm" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar clasificación'}</Button>
        </div>
      )}
      {unitTotal === 0 && !entry.archived_at && <p className="mt-2 text-xs text-stone-600">Sin equipos usando este nombre. Eso por sí solo no es evidencia de que esté obsoleta.</p>}
    </div>
  );
}

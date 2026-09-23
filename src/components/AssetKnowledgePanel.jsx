import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';

const BUTTON = 'rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50';

export function AssetKnowledgePanel({ assetUid }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const path = `/asset-knowledge/${encodeURIComponent(assetUid)}`;

  useEffect(() => {
    if (!assetUid) return;
    let current = true;
    setLoading(true); setError(''); setLinks([]);
    apiFetch(path).then((body) => { if (current) setLinks(body.data); })
      .catch((err) => { if (current) setError(err.message); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [path, assetUid, refresh]);

  useEffect(() => {
    if (!picker || !assetUid) return;
    let current = true;
    setSearching(true); setResults([]); setSearchError('');
    const timer = setTimeout(() => {
      apiFetch(`${path}/search?q=${encodeURIComponent(query)}`)
        .then((body) => { if (current) setResults(body.data); })
        .catch((err) => { if (current) setSearchError(err.message); })
        .finally(() => { if (current) setSearching(false); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [path, assetUid, picker, query, refresh]);

  async function changeLink(id, remove = false) {
    if (remove && !window.confirm('¿Retirar este vínculo? El artículo seguirá disponible en Tickets.')) return;
    setBusy(true); setNotice(''); setSearchError('');
    try {
      await apiFetch(remove ? `${path}/${id}` : path, {
        method: remove ? 'DELETE' : 'POST',
        ...(remove ? {} : { body: JSON.stringify({ article_id: id }) }),
      });
      setNotice(remove ? 'Vínculo retirado. El artículo se conserva en Tickets.' : 'Artículo vinculado al activo.');
      setRefresh((value) => value + 1);
    } catch (err) { setSearchError(err.message); }
    finally { setBusy(false); }
  }

  if (!assetUid) return <p className="text-sm text-slate-400">Guarda el activo para relacionar artículos.</p>;
  return <section className="space-y-4" aria-label="Artículos relacionados">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">Artículos relacionados</h2><p className="mt-1 text-sm text-slate-400">Procedimientos y soluciones de la base de conocimientos de Tickets para este equipo.</p></div>
      {!error && !loading && <button type="button" className={BUTTON} onClick={() => setPicker(!picker)}>{picker ? 'Cerrar búsqueda' : 'Vincular artículo'}</button>}
    </div>
    <p className="text-sm text-slate-400">Para números de parte, compatibilidades y fotografías, consulta las <Link className="text-sky-400 underline" to={`/referencias-tecnicas?asset_uid=${encodeURIComponent(assetUid)}`}>referencias técnicas de este equipo</Link>.</p>
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
    {loading && <p role="status" className="text-sm text-slate-400">Consultando artículos…</p>}
    {error && <p role="alert" className="text-sm text-amber-400">{error} <button type="button" className="underline" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></p>}
    {!loading && !error && <>
      {!links.length && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">Todavía no hay artículos vinculados. Usa “Vincular artículo” para seleccionar un procedimiento existente.</p>}
      <ul className="space-y-3">{links.map((link) => <li key={link.article_id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-700 p-4">
        <div className="min-w-0 flex-1">{link.article ? <>
          <a href={link.article.href} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-sky-400 underline">{link.article.title} ↗</a>
          {link.article.category_name && <p className="mt-1 text-xs text-slate-500">{link.article.category_name}</p>}
          <p className="mt-2 break-words text-sm text-slate-400">{link.article.snippet}</p>
        </> : <p className="text-sm text-slate-400">Artículo no disponible o sin publicar.</p>}</div>
        {link.can_remove && <button type="button" className={BUTTON} disabled={busy} onClick={() => changeLink(link.article_id, true)}>Retirar vínculo</button>}
      </li>)}</ul>
    </>}
    {searchError && <p role="alert" className="text-sm text-amber-400">{searchError}</p>}
    {picker && !error && <div className="space-y-3 rounded-xl border border-slate-700 p-4">
      <label className="block text-sm">Buscar artículos publicados<input type="search" maxLength={300} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Ej. configurar impresora o cambiar batería" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100" /></label>
      <p className="text-xs text-slate-500">Hasta 30 resultados. Puedes <a href="/tickets/knowledge-base" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">abrir la base de conocimientos</a> para consultar o redactar un procedimiento.</p>
      {searching ? <p role="status" className="text-sm text-slate-400">Buscando…</p> : !searchError && !results.length ? <p className="text-sm text-slate-400">No hay artículos publicados que coincidan.</p> : <ul className="max-h-80 space-y-2 overflow-y-auto">{results.map((article) => {
        const linked = links.some((link) => link.article_id === article.id);
        return <li key={article.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 p-3">
          <a href={article.href} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-words text-sm text-sky-400 underline">{article.title} ↗</a>
          <button type="button" disabled={busy || loading || linked} className={BUTTON} onClick={() => changeLink(article.id)}>{linked ? 'Vinculado' : 'Vincular'}</button>
        </li>;
      })}</ul>}
    </div>}
  </section>;
}

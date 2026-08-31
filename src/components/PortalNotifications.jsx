import { useCallback, useEffect, useRef, useState } from 'react';

function relativeTime(value) {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

export function PortalNotifications() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const response = await fetch('/api/portal/v1/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      setItems(Array.isArray(body.data) ? body.data : []);
      setError('');
    } catch {
      setError('No fue posible consultar las notificaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function close(event) {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !containerRef.current?.contains(event.target))) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  return (
    <div ref={containerRef} className="portal-module-notifications">
      <button type="button" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-700 bg-slate-900 text-amber-400 shadow-lg transition hover:border-amber-400 hover:bg-slate-800" aria-label={items.length ? `Ver ${items.length} notificaciones` : 'Ver notificaciones'} aria-expanded={open}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {items.length > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-slate-950 bg-red-600 px-1 text-[10px] font-bold text-white">{items.length > 9 ? '9+' : items.length}</span>}
      </button>
      {open && <section className="portal-module-notification-panel overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl" aria-label="Notificaciones">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3"><div><small className="block text-[10px] font-bold uppercase tracking-widest text-amber-400">Novedades</small><strong>Notificaciones</strong></div><button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full border border-slate-700 text-slate-400 hover:text-white" aria-label="Cerrar notificaciones">×</button></header>
        <div className="max-h-[min(30rem,70vh)] overflow-y-auto" aria-live="polite">
          {loading ? <p className="px-4 py-10 text-center text-sm text-slate-400">Buscando novedades…</p>
            : error ? <p className="bg-red-500/10 px-4 py-8 text-center text-sm text-red-300">{error}</p>
              : items.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">Sin novedades por ahora.</p>
                : items.map((item) => <article key={item.id} className="flex items-start gap-3 border-b border-slate-800 px-4 py-3 last:border-0"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-400/15 text-xs font-bold text-amber-400">TK</span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-100">{item.title}</strong><span className="mt-1 block text-xs leading-relaxed text-slate-400">{item.message}</span><small className="mt-1 block text-[11px] text-slate-500">{relativeTime(item.timestamp)}</small></span>{item.href && <a href={item.href} className="self-center text-xs font-semibold text-amber-400 hover:text-amber-300">Abrir →</a>}</article>)}
        </div>
      </section>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../api.js';
import { notifyAssetChanged } from '../assetEvents.js';

const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

// Confirmación para eliminar un activo: el botón sólo se habilita cuando se
// escribe a mano el Código TI exacto del equipo (pegar está bloqueado), y el
// servidor vuelve a validarlo. Se monta en document.body porque la ficha del
// activo es un <form> y no debe haber formularios anidados; aun así React
// propaga los eventos del portal a sus ancestros, por eso se detienen aquí.
export function DeleteAssetDialog({ asset, onClose, onDeleted }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const expected = normalizeCode(asset?.center_code);
  const matches = Boolean(expected) && normalizeCode(typed) === expected;

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function submit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!matches || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/activos/${asset.id}/eliminar`, { method: 'DELETE', body: JSON.stringify({ confirm_center_code: typed }) });
      notifyAssetChanged({ assetId: asset.id, action: 'deleted' });
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const description = [asset?.tipo, asset?.marca, asset?.modelo].filter(Boolean).join(' · ') || asset?.descripcion;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} role="alertdialog" aria-modal="true" aria-labelledby="delete-asset-title" aria-describedby="delete-asset-description" className="w-full max-w-md rounded-2xl border border-mrt-bad/30 bg-stone-900 p-6 shadow-2xl">
        <h2 id="delete-asset-title" className="text-lg font-bold text-mrt-bad-light">Eliminar activo</h2>
        <div id="delete-asset-description" className="mt-3 space-y-3 text-sm text-stone-300">
          <p>
            Vas a eliminar <strong className="text-stone-100">{asset?.center_code}</strong>{description ? <> ({description})</> : null}.
            Dejará de aparecer en el inventario y en toda la plataforma, y se cerrará su asignación actual.
          </p>
          <p className="text-xs text-stone-500">El registro en SAP no se modifica. Si fue un error, un administrador de sistemas puede recuperarlo.</p>
        </div>
        <label className="mt-5 block text-sm text-stone-300">
          Para confirmar, escribe el Código TI del equipo: <strong className="font-mono text-stone-100">{asset?.center_code}</strong>
          <input
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onPaste={(event) => event.preventDefault()}
            onDrop={(event) => event.preventDefault()}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder={asset?.center_code}
            aria-invalid={typed !== '' && !matches}
            className="mt-2 w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 font-mono text-sm text-stone-100 outline-none focus:border-mrt-bad"
          />
        </label>
        {typed !== '' && !matches && <p className="mt-2 text-xs text-mrt-warn-light">El código todavía no coincide.</p>}
        {error && <div className="mt-4 rounded-lg border border-mrt-bad/30 bg-mrt-bad/10 px-3 py-2 text-sm text-mrt-bad-light">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-stone-600 px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={!matches || busy} className="rounded-lg bg-mrt-bad px-4 py-2 text-sm font-semibold text-white hover:bg-mrt-bad disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Eliminando…' : 'Eliminar activo'}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

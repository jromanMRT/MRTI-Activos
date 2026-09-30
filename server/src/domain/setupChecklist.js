// Reglas del checklist de preparación de equipos (ver migración 028).
export const ENTRY_STATUSES = Object.freeze(['pending', 'done', 'na']);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function text(value, label, max, { required = false } = {}) {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) { if (required) throw invalid(`${label} es obligatorio`); return null; }
  if (normalized.length > max) throw invalid(`${label} no puede exceder ${max} caracteres`);
  return normalized;
}

export function normalizeItemInput(body = {}, { partial = false } = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);
  const result = {};
  if (!partial || has('label')) result.label = text(body.label, 'El paso', 255, { required: true });
  if (!partial || has('section')) result.section = text(body.section, 'La sección', 80, { required: true });
  if (!partial || has('help_text')) result.help_text = text(body.help_text, 'La ayuda', 500);
  if (has('is_active')) result.is_active = body.is_active ? 1 : 0;
  return result;
}

export function normalizeEntryUpdate(body = {}) {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = String(body.status);
    if (!ENTRY_STATUSES.includes(status)) throw invalid('El estado del paso no es válido');
    result.status = status;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'note')) result.note = text(body.note, 'La nota', 500);
  if (!Object.keys(result).length) throw invalid('No hay cambios que guardar');
  return result;
}

export function checklistProgress(entries = []) {
  const total = entries.length;
  const done = entries.filter((entry) => entry.status === 'done').length;
  const na = entries.filter((entry) => entry.status === 'na').length;
  const pending = total - done - na;
  return { total, done, na, pending, percent: total ? Math.round(((done + na) / total) * 100) : 0 };
}

// Solo se cierra cuando no queda nada pendiente ("no aplica" cuenta como resuelto).
export function assertCanComplete(entries) {
  const { pending } = checklistProgress(entries);
  if (pending) throw invalid(`Quedan ${pending} paso(s) pendientes; márcalos como hechos o "no aplica" antes de cerrar`);
}

// Nuevo orden de la plantilla a partir de la lista de ids en el orden deseado.
export function reorderPlan(ids) {
  if (!Array.isArray(ids) || !ids.length) throw invalid('Envía el orden de los pasos');
  const numeric = ids.map(Number);
  if (numeric.some((id) => !Number.isInteger(id) || id < 1) || new Set(numeric).size !== numeric.length) throw invalid('El orden enviado no es válido');
  return numeric.map((id, index) => ({ id, sort_order: (index + 1) * 10 }));
}

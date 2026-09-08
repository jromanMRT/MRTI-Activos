const STATUSES = new Set(['pending', 'not_returned', 'returned']);
const CONDITIONS = new Set(['good', 'fair', 'damaged', 'incomplete']);
const DESTINATIONS = new Set(['available', 'maintenance', 'retired']);
const ACCESSORIES = new Set(['charger', 'bag', 'monitor', 'phone', 'keyboard_mouse', 'other']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const OFFBOARDING_TASK_KEYS = Object.freeze(['core_account', 'corporate_email', 'microsoft365', 'dropbox', 'antivirus', 'network_access', 'phone_line', 'file_backup']);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function normalizeOffboardingItem(body = {}) {
  const status = String(body.status || 'pending');
  if (!STATUSES.has(status)) throw invalid('El estado de devolución no es válido');
  const dueDate = body.due_date ? String(body.due_date) : null;
  if (dueDate && !validDate(dueDate)) throw invalid('La fecha compromiso no es válida');
  const returnDate = body.return_date ? String(body.return_date) : null;
  if (returnDate && !validDate(returnDate)) throw invalid('La fecha de devolución no es válida');
  const condition = body.condition_state ? String(body.condition_state) : null;
  const destination = body.destination ? String(body.destination) : null;
  if (condition && !CONDITIONS.has(condition)) throw invalid('La condición del equipo no es válida');
  if (destination && !DESTINATIONS.has(destination)) throw invalid('El destino del equipo no es válido');
  if (status === 'returned' && (!condition || !destination)) throw invalid('Condición y destino son obligatorios al recibir el equipo');
  const accessories = Array.isArray(body.accessories)
    ? [...new Set(body.accessories.map(String).filter((item) => ACCESSORIES.has(item)))]
    : [];
  const notes = String(body.notes || '').trim();
  if (notes.length > 4000) throw invalid('Las observaciones no pueden exceder 4000 caracteres');
  return { status, due_date: dueDate, return_date: returnDate, condition_state: condition, destination, accessories, notes: notes || null };
}

export function destinationAssetState(destination) {
  return {
    available: { estado: 'Activo', active: 'Libre' },
    maintenance: { estado: 'En mantenimiento', active: 'tYES' },
    retired: { estado: 'Baja', active: 'tNO' },
  }[destination] || null;
}

export function parseAccessories(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

export function normalizeOffboardingChecklist(body = {}) {
  const status = body.status === 'completed' ? 'completed' : 'open';
  const input = body.tasks && typeof body.tasks === 'object' && !Array.isArray(body.tasks) ? body.tasks : {};
  const tasks = Object.fromEntries(OFFBOARDING_TASK_KEYS.map((key) => [key, input[key] === true]));
  if (status === 'completed' && Object.values(tasks).some((value) => !value)) throw invalid('Completa todos los controles antes de cerrar la baja');
  const notes = String(body.notes || '').trim();
  const employeeName = String(body.employee_name || '').trim();
  if (notes.length > 4000) throw invalid('Las notas de baja no pueden exceder 4000 caracteres');
  if (employeeName.length > 160) throw invalid('El nombre del empleado no es válido');
  return { status, tasks, notes: notes || null, employee_name: employeeName || null };
}

export function parseTasks(value) {
  let input = value;
  if (typeof value === 'string') { try { input = JSON.parse(value); } catch { input = {}; } }
  return Object.fromEntries(OFFBOARDING_TASK_KEYS.map((key) => [key, input?.[key] === true]));
}

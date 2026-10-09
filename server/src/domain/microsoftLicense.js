const MODES = new Set(['subscription', 'perpetual']);

function calendarDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

export function microsoftExpiration(startDate, years) {
  const date = calendarDate(startDate);
  const term = Number(years);
  if (!date || !Number.isInteger(term) || term < 1 || term > 100) return null;
  const targetYear = date.year + term;
  const lastDay = new Date(Date.UTC(targetYear, date.month, 0)).getUTCDate();
  return `${targetYear}-${String(date.month).padStart(2, '0')}-${String(Math.min(date.day, lastDay)).padStart(2, '0')}`;
}

export function normalizeMicrosoftLicense(fields, current = {}) {
  const merged = { ...current, ...fields };
  const touched = ['ms_license_mode', 'fecha_suscripcion', 'anos_suscripcion', 'ms_vencimiento']
    .some((key) => Object.hasOwn(fields, key));
  if (!touched) return fields;

  const mode = merged.ms_license_mode || null;
  if (mode && !MODES.has(mode)) {
    const error = new Error('La modalidad de licencia Microsoft no es válida');
    error.status = 400;
    throw error;
  }
  if (mode === 'perpetual') {
    return { ...fields, ms_license_mode: mode, anos_suscripcion: 0, ms_vencimiento: null };
  }
  if (mode === 'subscription') {
    const expiration = microsoftExpiration(merged.fecha_suscripcion, merged.anos_suscripcion);
    if (!expiration) {
      const error = new Error('La suscripción Microsoft requiere fecha de inicio y años enteros entre 1 y 100');
      error.status = 400;
      throw error;
    }
    return { ...fields, ms_license_mode: mode, anos_suscripcion: Number(merged.anos_suscripcion), ms_vencimiento: expiration };
  }
  return { ...fields, ms_vencimiento: null };
}

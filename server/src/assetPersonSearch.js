const RH_URL = process.env.MRTI_RH_URL || 'http://127.0.0.1:3004';

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

// Resolve all assigned references before SQL filtering/limiting the inventory.
// RH remains the owner of names and employee numbers; nothing is persisted.
export async function assetPersonSearch(db, authorization, query) {
  const [rows] = await db.query(`SELECT DISTINCT rh_employee_id, portal_user_id FROM activos
    WHERE rh_employee_id IS NOT NULL OR portal_user_id IS NOT NULL`);
  const references = [...new Map(rows.map((row) => row.rh_employee_id
    ? [`rh:${row.rh_employee_id}`, { employee_id: row.rh_employee_id }]
    : [`core:${row.portal_user_id}`, { portal_user_id: row.portal_user_id }])).values()];
  const matches = [];
  const terms = normalized(query).split(' ').filter(Boolean);
  try {
    for (let offset = 0; offset < references.length; offset += 1000) {
      const response = await fetch(`${RH_URL}/api/rh-self/asset-assignment-profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
        body: JSON.stringify({ references: references.slice(offset, offset + 1000) }),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error('RH unavailable');
      const body = await response.json();
      if (!Array.isArray(body.data)) throw new Error('Invalid RH response');
      matches.push(...body.data.filter((profile) => {
        const text = normalized(`${profile.full_name || ''} ${profile.employee_number || ''}`);
        return terms.every((term) => text.includes(term));
      }));
    }
  } catch {
    const error = new Error('No se pudo consultar RH para buscar por usuario asignado. Intenta nuevamente.');
    error.status = 503;
    throw error;
  }
  const employeeIds = [...new Set(matches.map((profile) => profile.id).filter(Boolean))];
  const portalIds = [...new Set(matches.map((profile) => profile.portal_user_id).filter(Boolean))];
  const clauses = [];
  const params = [];
  if (employeeIds.length) {
    clauses.push(`rh_employee_id IN (${employeeIds.map(() => '?').join(',')})`);
    params.push(...employeeIds);
  }
  if (portalIds.length) {
    clauses.push(`(rh_employee_id IS NULL AND portal_user_id IN (${portalIds.map(() => '?').join(',')}))`);
    params.push(...portalIds);
  }
  return { sql: clauses.join(' OR '), params };
}

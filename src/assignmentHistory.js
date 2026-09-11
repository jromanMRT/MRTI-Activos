export function assignmentReference(row) {
  if (row.rh_employee_id) return { employee_id: row.rh_employee_id };
  if (row.portal_user_id) return { portal_user_id: row.portal_user_id };
  return null;
}

export function assignmentPerson(row, profiles) {
  const profile = profiles.find((person) => row.rh_employee_id
    ? String(person.id) === String(row.rh_employee_id)
    : row.portal_user_id && person.portal_user_id === row.portal_user_id);
  return profile?.full_name || row.tercero_nombre
    || (row.rh_employee_id ? `Empleado RH #${row.rh_employee_id}` : row.portal_user_id ? `Cuenta ${row.portal_user_id}` : 'Persona no disponible');
}

export function assignedUnit(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Sin unidad asignada';
}

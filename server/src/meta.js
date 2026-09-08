// Metadatos de columnas de `activos`, agrupados para renderizar el
// formulario en el frontend sin duplicar la lista de campos en ambos lados.
// id/creado_en/actualizado_en no aparecen aquí: los gestiona la BD.

export const FIELD_GROUPS = [
  {
    key: 'identificacion',
    label: 'Identificación',
    fields: [
      { key: 'center_code', label: 'Código TI', type: 'text', required: true },
      { key: 'cod_activo_fijo', label: 'Código de activo fijo', type: 'text' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Laptop', 'PC', 'Servidor'] },
      { key: 'descripcion', label: 'Descripción', type: 'text' },
      { key: 'empresa', label: 'Empresa', type: 'text' },
      { key: 'unidad', label: 'Unidad', type: 'text' },
      { key: 'marca', label: 'Marca', type: 'text' },
      { key: 'modelo', label: 'Modelo', type: 'text' },
      { key: 'service_tag', label: 'Service tag', type: 'text' },
      { key: 'numero_serie', label: 'Número de serie', type: 'text' },
      { key: 'estado', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo', 'En mantenimiento', 'Baja'], required: true },
      { key: 'active', label: 'Activo (bandera)', type: 'text' },
    ],
  },
  {
    key: 'compra',
    label: 'Compra y administración',
    fields: [
      { key: 'cuenta_contable', label: 'Cuenta contable', type: 'text' },
      { key: 'expediente', label: 'Expediente', type: 'text' },
      { key: 'requisicion', label: 'Requisición', type: 'text' },
      { key: 'orden_compra', label: 'Orden de compra', type: 'text' },
      { key: 'factura', label: 'Factura', type: 'text' },
      { key: 'fecha_compra', label: 'Fecha de compra', type: 'date' },
      { key: 'garantia_hasta', label: 'Garantía hasta', type: 'date' },
      { key: 'valid_from', label: 'Válido desde', type: 'date' },
      { key: 'valid_to', label: 'Válido hasta', type: 'date' },
    ],
  },
  {
    key: 'software',
    label: 'Software y especificaciones',
    fields: [
      { key: 'cuenta_microsoft', label: 'Cuenta Microsoft', type: 'text' },
      { key: 'software_incluido', label: 'Software incluido', type: 'text' },
      { key: 'version', label: 'Versión', type: 'text' },
      { key: 'esp_tec', label: 'Especificaciones técnicas', type: 'textarea' },
      { key: 'bitlocker', label: 'Bitlocker', type: 'text' },
    ],
  },
  {
    key: 'windows',
    label: 'Windows',
    fields: [
      { key: 'win_cuenta', label: 'Cuenta Windows', type: 'text' },
      { key: 'win_usuario', label: 'Usuario Windows', type: 'text' },
      { key: 'win_comentario', label: 'Comentario Windows', type: 'text' },
    ],
  },
  {
    key: 'microsoft365',
    label: 'Microsoft 365',
    fields: [
      { key: 'ms_cuenta', label: 'Cuenta Microsoft 365', type: 'text' },
      { key: 'ms_usuario', label: 'Usuario Microsoft 365', type: 'text' },
      { key: 'ms_licencia', label: 'Licencia Microsoft 365', type: 'text' },
      { key: 'ms_suscripcion', label: 'Suscripción', type: 'text' },
      { key: 'fecha_suscripcion', label: 'Fecha de suscripción', type: 'date' },
      { key: 'anos_suscripcion', label: 'Años de suscripción', type: 'number' },
    ],
  },
  {
    key: 'dropbox',
    label: 'Dropbox',
    fields: [
      { key: 'db_cuenta', label: 'Cuenta Dropbox', type: 'text' },
      { key: 'db_usuario', label: 'Usuario Dropbox', type: 'text' },
      { key: 'db_licencia', label: 'Licencia Dropbox', type: 'text' },
    ],
  },
  {
    key: 'correo',
    label: 'Correo',
    fields: [
      { key: 'correo_mrt', label: 'Correo MRT', type: 'text' },
      { key: 'correo_corporativo', label: 'Correo corporativo', type: 'text' },
      { key: 'correo_nombre', label: 'Nombre en correo', type: 'text' },
      { key: 'correo_depto', label: 'Departamento', type: 'text' },
      { key: 'correo_puesto', label: 'Puesto', type: 'text' },
      { key: 'correo_baja', label: 'Correo de baja', type: 'text' },
      { key: 'migrado', label: 'Migrado', type: 'text' },
    ],
  },
  {
    key: 'antivirus',
    label: 'Antivirus',
    fields: [
      { key: 'av_licencia', label: 'Licencia antivirus', type: 'text' },
      { key: 'av_caducidad', label: 'Caducidad antivirus', type: 'date' },
      { key: 'av_team', label: 'Equipo antivirus', type: 'text' },
      { key: 'av_comentario', label: 'Comentario antivirus', type: 'text' },
    ],
  },
  {
    key: 'baja',
    label: 'Baja y notas',
    fields: [
      { key: 'baja_empleado', label: 'Baja de empleado', type: 'text' },
      { key: 'baja_equipo', label: 'Baja de equipo', type: 'text' },
      { key: 'revisada', label: 'Revisada', type: 'text' },
      { key: 'ex_propietario', label: 'Ex propietario', type: 'text' },
      { key: 'notas', label: 'Notas', type: 'textarea' },
    ],
  },
];

export const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.key));

// Campos `type: 'date'` -- derivado de FIELD_GROUPS, no hardcodeado, para que
// un campo de fecha nuevo quede cubierto automáticamente.
export const DATE_FIELDS = new Set(
  FIELD_GROUPS.flatMap((group) => group.fields.filter((field) => field.type === 'date').map((field) => field.key))
);

// mysql2 entrega DATETIME/DATE como objeto Date de JS; JSON.stringify lo
// serializa en UTC ('2026-06-15T00:00:00.000Z') aunque la fila guarde una
// fecha simple sin hora -- con el servidor en zona horaria distinta a UTC
// eso corre el día mostrado. Estos campos son fechas de calendario, no
// momentos en el tiempo: se devuelven como 'AAAA-MM-DD' puro, sin objeto
// Date ni conversión de huso horario de por medio.
export function normalizeAssetDates(row) {
  if (!row) return row;
  const normalized = { ...row };
  for (const key of DATE_FIELDS) {
    if (normalized[key] instanceof Date) {
      const date = normalized[key];
      normalized[key] = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
  }
  return normalized;
}

export const LIST_COLUMNS = [
  'id', 'asset_uid', 'center_code', 'tipo', 'descripcion', 'marca', 'modelo',
  'usuario_asignado', 'id_empleado', 'unidad', 'area', 'empresa', 'estado',
  'service_tag', 'numero_serie', 'fecha_compra', 'creado_en',
  'portal_user_id', 'tercero_id', 'rh_employee_id',
];

const DEFAULT_CAPACITY = 5;

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function dateValues(devices, field) {
  return [...new Set(devices.map((device) => text(device[field])).filter(Boolean))].sort();
}

export function canonicalAntivirusLicense(value) {
  return text(value).replace(/\s+/g, ' ').toLocaleUpperCase('es-MX');
}

export function groupAntivirusLicenses(rows = [], capacity = DEFAULT_CAPACITY) {
  const groups = new Map();
  for (const row of rows) {
    const canonical = canonicalAntivirusLicense(row.av_licencia);
    const key = canonical ? `license:${canonical}` : `asset:${row.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()].map(([groupKey, devices]) => {
    const sortedDevices = [...devices].sort((left, right) => text(left.center_code).localeCompare(text(right.center_code), 'es-MX', { numeric: true }));
    const purchaseDates = dateValues(sortedDevices, 'fecha_adquisicion');
    const expirationDates = dateValues(sortedDevices, 'fecha_vence');
    const licenseKey = text(sortedDevices.find((device) => text(device.av_licencia))?.av_licencia) || null;
    const purchaseConflict = purchaseDates.length > 1;
    const expirationConflict = expirationDates.length > 1;
    let dateStatus = 'Fechas uniformes';
    if (!expirationDates.length) dateStatus = 'Sin vencimiento';
    else if (purchaseConflict && expirationConflict) dateStatus = 'Compras y vencimientos distintos';
    else if (purchaseConflict) dateStatus = 'Compras distintas';
    else if (expirationConflict) dateStatus = 'Vencimientos distintos';
    const deviceCount = sortedDevices.length;
    const numericCapacity = Number.isInteger(Number(capacity)) && Number(capacity) > 0 ? Number(capacity) : DEFAULT_CAPACITY;
    const earliestDays = sortedDevices
      .map((device) => Number(device.dias_restantes))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    return {
      id: Math.min(...sortedDevices.map((device) => Number(device.id))),
      asset_uid: `antivirus-group-${Math.min(...sortedDevices.map((device) => Number(device.id)))}`,
      group_key: groupKey,
      license_key: licenseKey,
      av_licencia: licenseKey,
      capacity: numericCapacity,
      device_count: deviceCount,
      available_seats: Math.max(numericCapacity - deviceCount, 0),
      over_capacity: deviceCount > numericCapacity,
      center_codes: sortedDevices.map((device) => text(device.center_code) || 'Sin código').join(', '),
      devices: sortedDevices.map((device) => ({ id: device.id, asset_uid: device.asset_uid, center_code: device.center_code, usuario_asignado: device.usuario_asignado || null })),
      purchase_dates: purchaseDates,
      expiration_dates: expirationDates,
      fecha_adquisicion: purchaseDates[0] || null,
      fecha_adquisicion_hasta: purchaseDates.at(-1) || null,
      fecha_vence: expirationDates[0] || null,
      fecha_vence_hasta: expirationDates.at(-1) || null,
      purchase_conflict: purchaseConflict,
      expiration_conflict: expirationConflict,
      date_status: dateStatus,
      dias_restantes: earliestDays ?? null,
    };
  }).sort((left, right) => {
    if (!left.fecha_vence || !right.fecha_vence) return left.fecha_vence ? -1 : right.fecha_vence ? 1 : 0;
    return left.fecha_vence.localeCompare(right.fecha_vence) || text(left.license_key).localeCompare(text(right.license_key), 'es-MX');
  });
}

export async function loadAntivirusLicenseGroups(db) {
  try {
    const [licenses] = await db.query(`SELECT l.id, l.display_name, l.license_key, l.purchase_date,
        l.expires_on, l.seat_capacity, l.provider, l.purchase_reference, l.notes,
        l.migration_status, p.id AS product_id, p.vendor, p.name AS product_name,
        DATE_FORMAT(l.purchase_date, '%Y-%m-%d') AS fecha_adquisicion,
        DATE_FORMAT(l.expires_on, '%Y-%m-%d') AS fecha_vence,
        DATEDIFF(l.expires_on, CURDATE()) AS dias_restantes
      FROM antivirus_licenses l
      JOIN antivirus_products p ON p.id=l.product_id
      WHERE l.archived_at IS NULL
      ORDER BY l.expires_on IS NULL, l.expires_on, p.vendor, l.license_key`);
    const [assignments] = await db.query(`SELECT ala.license_id, a.id, a.asset_uid, a.center_code,
        a.descripcion, a.usuario_asignado, a.numero_serie
      FROM antivirus_license_assets ala
      JOIN activos a ON a.asset_uid=ala.asset_uid
      WHERE ala.unassigned_at IS NULL
      ORDER BY a.center_code`);
    const devicesByLicense = new Map();
    for (const assignment of assignments) {
      if (!devicesByLicense.has(assignment.license_id)) devicesByLicense.set(assignment.license_id, []);
      devicesByLicense.get(assignment.license_id).push(assignment);
    }
    const canonical = licenses.map((license) => {
      const devices = devicesByLicense.get(license.id) || [];
      const capacity = Number(license.seat_capacity);
      return {
        ...license,
        asset_uid: `antivirus-license-${license.id}`,
        group_key: `license:${license.id}`,
        av_licencia: license.license_key,
        capacity,
        device_count: devices.length,
        available_seats: Math.max(capacity - devices.length, 0),
        over_capacity: devices.length > capacity,
        center_codes: devices.map((device) => text(device.center_code) || 'Sin código').join(', '),
        devices,
        purchase_dates: license.fecha_adquisicion ? [license.fecha_adquisicion] : [],
        expiration_dates: license.fecha_vence ? [license.fecha_vence] : [],
        purchase_conflict: false,
        expiration_conflict: false,
        date_status: license.migration_status === 'needs_review' ? 'Revisar datos migrados' : license.fecha_vence ? 'Datos confirmados' : 'Sin caducidad',
        legacy: false,
      };
    });
    const [unlinkedRows] = await db.query(`SELECT a.id, a.asset_uid, a.center_code, a.usuario_asignado, a.av_licencia,
        DATE_FORMAT(DATE(a.av_caducidad), '%Y-%m-%d') AS fecha_adquisicion,
        DATE_FORMAT(COALESCE(a.av_vencimiento, DATE_ADD(DATE(a.av_caducidad), INTERVAL 1 YEAR)), '%Y-%m-%d') AS fecha_vence,
        DATEDIFF(COALESCE(a.av_vencimiento, DATE_ADD(DATE(a.av_caducidad), INTERVAL 1 YEAR)), CURDATE()) AS dias_restantes
      FROM activos a
      LEFT JOIN antivirus_license_assets ala ON ala.asset_uid=a.asset_uid AND ala.unassigned_at IS NULL
      WHERE a.estado='Activo' AND ala.id IS NULL
        AND (NULLIF(TRIM(a.av_licencia), '') IS NOT NULL OR a.av_caducidad IS NOT NULL OR a.av_vencimiento IS NOT NULL)
      ORDER BY a.av_licencia, a.center_code`);
    const legacy = groupAntivirusLicenses(unlinkedRows).map((group) => ({ ...group, legacy: true, migration_status: 'needs_review', date_status: group.license_key ? group.date_status : 'Sin licencia canónica' }));
    return [...canonical, ...legacy].sort((left, right) => {
      if (!left.fecha_vence || !right.fecha_vence) return left.fecha_vence ? -1 : right.fecha_vence ? 1 : 0;
      return left.fecha_vence.localeCompare(right.fecha_vence);
    });
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
    const [rows] = await db.query(`SELECT id, asset_uid, center_code, usuario_asignado, av_licencia,
        DATE_FORMAT(DATE(av_caducidad), '%Y-%m-%d') AS fecha_adquisicion,
        DATE_FORMAT(COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)), '%Y-%m-%d') AS fecha_vence,
        DATEDIFF(COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)), CURDATE()) AS dias_restantes
      FROM activos WHERE estado='Activo'
        AND (NULLIF(TRIM(av_licencia), '') IS NOT NULL OR av_caducidad IS NOT NULL OR av_vencimiento IS NOT NULL)
      ORDER BY av_licencia, center_code`);
    return groupAntivirusLicenses(rows).map((group) => ({ ...group, legacy: true, migration_status: 'needs_review' }));
  }
}

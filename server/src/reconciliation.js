export function normalizeAssetKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// El número de empleado en Activos (importado de SAP) no siempre trae los
// mismos ceros a la izquierda que `employees.employee_number` en RH
// ('926' vs '0926') -- se comparan solo los dígitos, sin relleno.
export function normalizeEmployeeNumber(value) {
  const digits = String(value || '').trim().replace(/\D/g, '');
  if (!digits) return '';
  const stripped = digits.replace(/^0+/, '');
  return stripped || '0';
}

// Conjunto de palabras de un nombre de persona, sin acentos/mayúsculas ni
// depender del orden -- Activos guarda "Apellido Apellido Nombre(s)" y RH
// "Nombre(s) Apellido Apellido", y a veces ninguno de los dos es en
// realidad el nombre de una persona (ej. "Dañada", el nombre de un
// laboratorio) -- en ese caso el conjunto de palabras compartidas con
// cualquier nombre real será bajo o nulo.
export function nameTokens(value) {
  return new Set(
    String(value || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z ]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 1)
  );
}

// "Confía" en la coincidencia solo si comparten al menos 2 palabras y esas
// palabras cubren al menos 3/4 del nombre más corto -- suficiente para
// tolerar diferencias de orden/acentos, pero rechaza nombres distintos
// (0 palabras en común) y coincidencias parciales dudosas como apodos.
export function namesLikelyMatch(nameA, nameB) {
  const a = nameTokens(nameA);
  const b = nameTokens(nameB);
  if (!a.size || !b.size) return false;
  const shared = [...a].filter((token) => b.has(token)).length;
  const smaller = Math.min(a.size, b.size);
  return shared >= 2 && shared / smaller >= 0.75;
}

// asset: { id, id_empleado, usuario_asignado }
// employee: { id, employee_number, full_name, portal_user_id }
// No vincula nunca en silencio: sin id_empleado ('no_id'), sin candidato en
// RH ('not_found'), más de un candidato para el mismo número ('ambiguous')
// o nombre que no coincide con el titular real de ese número
// ('name_mismatch') quedan fuera -- solo 'matched' es apto para escribir.
export function matchRhEmployees(assets, employees) {
  const byNumber = new Map();
  for (const employee of employees) {
    const key = normalizeEmployeeNumber(employee.employee_number);
    if (!key) continue;
    const list = byNumber.get(key) || [];
    list.push(employee);
    byNumber.set(key, list);
  }

  return assets.map((asset) => {
    const key = normalizeEmployeeNumber(asset.id_empleado);
    if (!key) return { asset_id: asset.id, status: 'no_id', employee: null };
    const candidates = byNumber.get(key) || [];
    if (candidates.length === 0) return { asset_id: asset.id, status: 'not_found', employee: null };
    if (candidates.length > 1) return { asset_id: asset.id, status: 'ambiguous', employee: null };
    const [employee] = candidates;
    if (!namesLikelyMatch(asset.usuario_asignado, employee.full_name)) {
      return { asset_id: asset.id, status: 'name_mismatch', employee };
    }
    return { asset_id: asset.id, status: 'matched', employee };
  });
}

export function matchObservedDevices(assets, devices) {
  const bySerial = new Map();
  const byInventoryTag = new Map();
  const add = (map, rawKey, asset) => {
    const key = normalizeAssetKey(rawKey);
    if (!key) return;
    const values = map.get(key) || [];
    values.push(asset);
    map.set(key, values);
  };
  for (const asset of assets) {
    add(bySerial, asset.numero_serie, asset);
    add(bySerial, asset.service_tag, asset);
    add(byInventoryTag, asset.cod_activo_fijo, asset);
  }

  return devices.map((device) => {
    const candidates = new Map();
    for (const asset of bySerial.get(normalizeAssetKey(device.serial_number)) || []) {
      candidates.set(asset.asset_uid, asset);
    }
    for (const asset of byInventoryTag.get(normalizeAssetKey(device.inventory_tag)) || []) {
      candidates.set(asset.asset_uid, asset);
    }
    const matches = [...candidates.values()];
    return {
      device_id: device.id,
      asset_id: matches.length === 1 ? matches[0].asset_uid : null,
      status: matches.length === 1 ? 'matched' : matches.length > 1 ? 'ambiguous' : 'unmatched',
    };
  });
}

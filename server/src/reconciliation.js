export function normalizeAssetKey(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
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

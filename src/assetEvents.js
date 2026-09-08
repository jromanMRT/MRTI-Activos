export const ASSET_CHANGED_EVENT = 'mrti:asset-changed';

export function notifyAssetChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(ASSET_CHANGED_EVENT, { detail }));
}

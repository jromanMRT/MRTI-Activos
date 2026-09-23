const DEFAULT_NOTICE_DAYS = 30;
const MAX_NOTICE_DAYS = 3650;

export function normalizeNoticeDays(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_NOTICE_DAYS;
  return Math.min(parsed, MAX_NOTICE_DAYS);
}

export function noticeConfiguration(rows = []) {
  const byKey = new Map(rows.map((row) => [row.clave, row]));
  const config = (key) => {
    const row = byKey.get(key);
    return { active: row ? Boolean(row.activo) : true, days: normalizeNoticeDays(row?.dias_aviso) };
  };
  return { antivirus: config('antivirus'), office365: config('o365'), fortigate: config('fortigate') };
}

export async function loadLicenseAlerts(db) {
  const [configRows] = await db.query(
    "SELECT clave, dias_aviso, activo FROM sap_config_alertas WHERE clave IN ('antivirus','o365','fortigate')"
  );
  const config = noticeConfiguration(configRows);
  const empty = Promise.resolve([[]]);
  const [antivirusResult, officeResult, fortigateResult] = await Promise.all([
    config.antivirus.active ? db.query(`SELECT id, asset_uid, center_code, usuario_asignado, av_licencia,
        DATE(av_caducidad) AS fecha_adquisicion,
        COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)) AS fecha_vence,
        DATEDIFF(COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)), CURDATE()) AS dias_restantes
      FROM activos
      WHERE estado = 'Activo'
        AND COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)) IS NOT NULL
        AND COALESCE(av_vencimiento, DATE_ADD(DATE(av_caducidad), INTERVAL 1 YEAR)) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY fecha_vence, center_code`, [config.antivirus.days]) : empty,
    config.office365.active ? db.query(`SELECT id, asset_uid, center_code, usuario_asignado, ms_cuenta, ms_usuario, ms_licencia,
        fecha_suscripcion, anos_suscripcion,
        COALESCE(ms_vencimiento,
          CASE WHEN fecha_suscripcion IS NOT NULL AND COALESCE(anos_suscripcion, 1) > 0
            THEN DATE_ADD(DATE(fecha_suscripcion), INTERVAL COALESCE(anos_suscripcion, 1) YEAR)
          END) AS fecha_vence,
        DATEDIFF(COALESCE(ms_vencimiento,
          CASE WHEN fecha_suscripcion IS NOT NULL AND COALESCE(anos_suscripcion, 1) > 0
            THEN DATE_ADD(DATE(fecha_suscripcion), INTERVAL COALESCE(anos_suscripcion, 1) YEAR)
          END), CURDATE()) AS dias_restantes
      FROM activos
      WHERE estado = 'Activo'
        AND COALESCE(ms_vencimiento,
          CASE WHEN fecha_suscripcion IS NOT NULL AND COALESCE(anos_suscripcion, 1) > 0
            THEN DATE_ADD(DATE(fecha_suscripcion), INTERVAL COALESCE(anos_suscripcion, 1) YEAR)
          END) IS NOT NULL
        AND COALESCE(ms_vencimiento,
          CASE WHEN fecha_suscripcion IS NOT NULL AND COALESCE(anos_suscripcion, 1) > 0
            THEN DATE_ADD(DATE(fecha_suscripcion), INTERVAL COALESCE(anos_suscripcion, 1) YEAR)
          END) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY fecha_vence, center_code`, [config.office365.days]) : empty,
    config.fortigate.active ? db.query(`SELECT id, asset_uid, software, numero_serie, proyecto,
        DATE(fecha_expira) AS fecha_expira, DATE(fecha_expira) AS fecha_vence,
        DATEDIFF(DATE(fecha_expira), CURDATE()) AS dias_restantes
      FROM sap_fortigate
      WHERE archived_at IS NULL AND fecha_expira IS NOT NULL
        AND DATE(fecha_expira) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY fecha_expira`, [config.fortigate.days]) : empty,
  ]);
  return {
    antivirus: antivirusResult[0], office365: officeResult[0], fortigate: fortigateResult[0], config,
  };
}

function dateText(value) {
  if (!value) return 'sin fecha';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  if (value instanceof Date) return value.toLocaleDateString('es-MX');
  return String(value);
}

export function licenseNotifications(alerts, timestamp = new Date().toISOString()) {
  const definitions = [
    { key: 'antivirus', label: 'Antivirus', rows: alerts.antivirus || [], href: '/activos/alertas?tipo=antivirus', assetLabel: (row) => row.center_code },
    { key: 'office365', label: 'Microsoft 365', rows: alerts.office365 || [], href: '/activos/alertas?tipo=office365', assetLabel: (row) => row.center_code },
    { key: 'fortigate', label: 'FortiGate', rows: alerts.fortigate || [], href: '/activos/alertas?tipo=fortigate', assetLabel: (row) => row.numero_serie || row.software },
  ];
  const items = [];
  for (const source of definitions) {
    const overdue = source.rows.filter((row) => Number(row.dias_restantes) < 0);
    const upcoming = source.rows.filter((row) => Number(row.dias_restantes) >= 0);
    if (overdue.length) {
      items.push({
        id: `asset-license:${source.key}:overdue`, kind: 'asset_license_overdue',
        title: `⚠️ ${overdue.length} ${source.label} ${overdue.length === 1 ? 'vencida' : 'vencidas'}`,
        message: 'Revisa la lista de activos para renovar o corregir sus fechas.', timestamp, href: source.href,
      });
    }
    for (const row of upcoming.slice(0, 20)) {
      const days = Number(row.dias_restantes);
      const subject = source.assetLabel(row) || 'Activo sin identificar';
      items.push({
        id: `asset-license:${source.key}:${row.asset_uid || row.id}:${dateText(row.fecha_vence)}`,
        kind: 'asset_license_upcoming', title: `${source.label} de ${subject} por vencer`,
        message: days === 0 ? `Vence hoy (${dateText(row.fecha_vence)}).` : `Vence en ${days} ${days === 1 ? 'día' : 'días'} (${dateText(row.fecha_vence)}).`,
        timestamp, href: source.href,
      });
    }
    if (upcoming.length > 20) {
      items.push({
        id: `asset-license:${source.key}:more-upcoming`, kind: 'asset_license_upcoming',
        title: `${upcoming.length - 20} vencimientos adicionales de ${source.label}`,
        message: 'Abre Alertas de activos para consultar la lista completa.', timestamp, href: source.href,
      });
    }
  }
  return items;
}

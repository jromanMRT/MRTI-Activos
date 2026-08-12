const IDENTIFIER = /^[a-zA-Z0-9_$-]+$/;

export function parsePositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo`);
  }
  return parsed;
}

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) return true;
  if (['0', 'false', 'no'].includes(normalized)) return false;
  throw new Error(`Valor booleano inválido: ${value}`);
}

export function assertIdentifier(value, name) {
  if (!value || !IDENTIFIER.test(value)) {
    throw new Error(`${name} contiene caracteres no permitidos`);
  }
  return value;
}

export function externalSourceConfig(env = process.env) {
  const required = [
    'EXTERNAL_MYSQL_HOST',
    'EXTERNAL_MYSQL_USER',
    'EXTERNAL_MYSQL_PASSWORD',
    'EXTERNAL_MYSQL_DATABASE',
  ];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Faltan variables de la fuente externa: ${missing.join(', ')}`);
  }

  return {
    host: env.EXTERNAL_MYSQL_HOST,
    port: parsePositiveInteger(env.EXTERNAL_MYSQL_PORT, 3306, 'EXTERNAL_MYSQL_PORT'),
    user: env.EXTERNAL_MYSQL_USER,
    password: env.EXTERNAL_MYSQL_PASSWORD,
    database: assertIdentifier(env.EXTERNAL_MYSQL_DATABASE, 'EXTERNAL_MYSQL_DATABASE'),
    connectTimeout: parsePositiveInteger(
      env.EXTERNAL_MYSQL_CONNECT_TIMEOUT_MS,
      5000,
      'EXTERNAL_MYSQL_CONNECT_TIMEOUT_MS'
    ),
    ssl: parseBoolean(env.EXTERNAL_MYSQL_SSL) ? { rejectUnauthorized: true } : undefined,
  };
}

export function hasReadOnlyGrants(grants) {
  const normalized = grants.map((grant) => grant.toUpperCase()).join('\n');
  if (/GRANT\s+ALL(?:\s+PRIVILEGES)?\s+ON/.test(normalized)) return false;

  const writePrivileges = [
    'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'INDEX',
    'TRIGGER', 'EXECUTE', 'EVENT', 'LOCK TABLES', 'REFERENCES', 'RELOAD',
    'SHUTDOWN', 'PROCESS', 'FILE', 'SUPER', 'CREATE USER', 'GRANT OPTION',
  ];
  return !writePrivileges.some((privilege) => {
    const pattern = new RegExp(`(?:GRANT|,)\\s*${privilege.replace(' ', '\\s+')}\\b`);
    return pattern.test(normalized);
  });
}

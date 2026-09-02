import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Cifrado en reposo para las pocas columnas que sí son contraseñas reales
// (sap_nvr.password_encrypted, sap_passwords.password_encrypted) -- decisión
// explícita: se traen desde SAP, pero nunca en texto plano en esta base.
// AES-256-GCM: autenticado (detecta si el valor fue alterado), IV nuevo por
// valor. La llave nunca vive en la base de datos, solo en CREDENTIALS_
// ENCRYPTION_KEY (server/.env) -- por diseño, tener acceso a la base de
// datos por sí solo no alcanza para leer estas contraseñas.
const KEY = process.env.CREDENTIALS_ENCRYPTION_KEY
  ? scryptSync(process.env.CREDENTIALS_ENCRYPTION_KEY, 'mrti-activos-credentials', 32)
  : null;

export function isCredentialCryptoConfigured() {
  return Boolean(KEY);
}

export function encryptSecret(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  if (!KEY) throw new Error('CREDENTIALS_ENCRYPTION_KEY no está configurada');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded) {
  if (!encoded) return null;
  if (!KEY) throw new Error('CREDENTIALS_ENCRYPTION_KEY no está configurada');
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

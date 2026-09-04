import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from './db.js';
import { fetchCurrentUser } from './auth.js';

const SENSITIVE_KEY = /password|passphrase|token|secret|authorization|cookie|api.?key|credential|clave|verific|hash|curp|rfc|nss|salary|sueldo|bank|clabe|medical|health|birth.?date/i;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export function sanitizeAuditValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[profundidad limitada]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return `[archivo ${value.length} bytes]`;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTADO]' : sanitizeAuditValue(item, depth + 1)]));
}
export function mutationDescriptor(method, originalUrl) {
  const parts = String(originalUrl || '').split('?')[0].split('/').filter(Boolean);
  if (parts[0] === 'api') parts.shift();
  const entityType = parts[0] || 'unknown';
  const entityId = parts.slice(1).find((part) => /^\d+$|^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part)) || null;
  return { entityType, entityId, action: `${entityType}.${{ POST: 'created', PUT: 'replaced', PATCH: 'updated', DELETE: 'deleted' }[method] || 'changed'}` };
}
const json = (value) => value === null || value === undefined ? null : JSON.stringify(sanitizeAuditValue(value)).slice(0, 16000);
export function auditMutations() {
  return (req, res, next) => {
    if (!MUTATION_METHODS.has(req.method)) return next();
    const requestId = randomUUID(); const requestBody = sanitizeAuditValue(req.body); let responseBody = null;
    const originalJson = res.json.bind(res); res.json = (body) => { responseBody = sanitizeAuditValue(body); return originalJson(body); };
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 400) return;
      void (async () => {
        const actor = req.portalUser || await fetchCurrentUser(req.headers.authorization); const descriptor = mutationDescriptor(req.method, req.originalUrl);
        await pool.query(`INSERT INTO audit_events
          (event_uuid,module_code,actor_user_id,actor_name,actor_email,action,entity_type,entity_id,request_id,ip_address,user_agent,after_json,metadata_json,status_code)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [randomUUID(),'activos',actor?.id||null,actor?.name||null,actor?.email||null,descriptor.action,descriptor.entityType,descriptor.entityId,requestId,req.ip||null,String(req.headers['user-agent']||'').slice(0,512)||null,json(responseBody?.data ?? requestBody),json({method:req.method,path:req.originalUrl.split('?')[0],request:requestBody}),res.statusCode]);
      })().catch((error) => console.error('[audit:activos] no fue posible registrar evento:', error.message));
    }); next();
  };
}
async function administratorOnly(req,res,next) {
  const actor=req.portalUser||await fetchCurrentUser(req.headers.authorization); if(!actor)return res.status(401).json({error:'No autenticado'});
  if(String(actor.role||'').toLowerCase()!=='administrator')return res.status(403).json({error:'Sólo administradores pueden consultar auditoría'});
  req.portalUser=actor; return next();
}
export const auditRouter=Router();
auditRouter.get('/audit-events',administratorOnly,async(req,res,next)=>{try{const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);const[rows]=await pool.query(`SELECT event_uuid,module_code,actor_user_id,actor_name,actor_email,action,entity_type,entity_id,request_id,ip_address,user_agent,before_json,after_json,metadata_json,status_code,created_at FROM audit_events ORDER BY id DESC LIMIT ?`,[limit]);res.json({data:rows});}catch(error){next(error);}});

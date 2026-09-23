import { Router } from 'express';
import { pool } from '../db.js';
import { knowledgeRequest, articleSummary } from '../integrations/knowledgeClient.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const canRemove = (link, actor) => link.created_by === actor.id || actor.role === 'administrator';
function articleId(value) {
  if (!/^[1-9]\d{0,9}$/.test(String(value)) || Number(value) > 4294967295) throw fail('Artículo inválido.');
  return Number(value);
}

export function createAssetKnowledgeRouter(db = pool, request = knowledgeRequest) {
  const router = Router();
  router.use('/:assetUid', async (req, res, next) => {
    try {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.assetUid)) throw fail('Activo inválido.');
      const [[asset]] = await db.query('SELECT asset_uid FROM activos WHERE asset_uid = ?', [req.params.assetUid]);
      if (!asset) throw fail('Activo no encontrado.', 404);
      req.knowledgeAssetUid = asset.asset_uid;
      res.set('Cache-Control', 'no-store');
      next();
    } catch (error) { next(error); }
  });

  router.get('/:assetUid/search', async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      if (q.length > 300) throw fail('La búsqueda admite hasta 300 caracteres.');
      const params = new URLSearchParams({ status: 'published' });
      if (q) params.set('q', q);
      const articles = await request(`?${params}`, req.headers.authorization);
      if (!Array.isArray(articles)) throw fail('Respuesta inválida de Tickets.', 503);
      res.json({ data: articles.filter((a) => a.status === 'published').slice(0, 30).map(articleSummary) });
    } catch (error) { next(error); }
  });

  router.get('/:assetUid', async (req, res, next) => {
    try {
      // Validate Tickets even when no links exist; never reveal stale titles.
      const articles = await request('?status=published', req.headers.authorization);
      if (!Array.isArray(articles)) throw fail('Respuesta inválida de Tickets.', 503);
      const published = new Map(articles.filter((a) => a.status === 'published').map((a) => [Number(a.id), a]));
      const [links] = await db.query('SELECT article_id, created_by FROM asset_knowledge_links WHERE asset_uid = ? AND archived_at IS NULL ORDER BY created_at DESC', [req.knowledgeAssetUid]);
      res.json({ data: links.map((link) => {
        const article = published.get(Number(link.article_id));
        return { article_id: Number(link.article_id), can_remove: canRemove(link, req.portalUser),
          article: article ? articleSummary(article) : null };
      }) });
    } catch (error) { next(error); }
  });

  router.post('/:assetUid', async (req, res, next) => {
    try {
      const id = articleId(req.body.article_id);
      const article = await request(`/${id}`, req.headers.authorization);
      if (article.status !== 'published' || Number(article.id) !== id) throw fail('Sólo puedes vincular artículos publicados.', 404);
      // Unique key prevents duplicate links, including concurrent requests.
      // Re-linking an archived relationship does not recreate the article.
      await db.query(`INSERT INTO asset_knowledge_links (asset_uid, article_id, created_by) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE created_by = IF(archived_at IS NOT NULL, VALUES(created_by), created_by),
        created_at = IF(archived_at IS NOT NULL, CURRENT_TIMESTAMP, created_at), archived_by = NULL, archived_at = NULL`,
      [req.knowledgeAssetUid, id, req.portalUser.id]);
      res.json({ data: { article_id: id } });
    } catch (error) { next(error); }
  });

  router.delete('/:assetUid/:articleId', async (req, res, next) => {
    try {
      const id = articleId(req.params.articleId);
      // Removing one's own reference does not read or mutate Tickets.
      const [result] = await db.query(`UPDATE asset_knowledge_links SET archived_at = CURRENT_TIMESTAMP, archived_by = ?
        WHERE asset_uid = ? AND article_id = ? AND archived_at IS NULL AND (created_by = ? OR ? = 'administrator')`,
      [req.portalUser.id, req.knowledgeAssetUid, id, req.portalUser.id, req.portalUser.role]);
      if (!result.affectedRows) throw fail('El vínculo no existe o sólo su autor o un administrador puede retirarlo.', 403);
      res.json({ data: { article_id: id, archived: true } });
    } catch (error) { next(error); }
  });
  return router;
}

export const assetKnowledgeRouter = createAssetKnowledgeRouter();

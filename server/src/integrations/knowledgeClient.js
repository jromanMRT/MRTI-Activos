const failure = (message, status = 503) => Object.assign(new Error(message), { status });

// Forward the user's session: Activos access never grants Tickets access.
export async function knowledgeRequest(path, authorization, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(`${process.env.MRTI_TICKETS_URL || 'http://127.0.0.1:4000'}/api/kb-articles${path}`, {
      headers: { Authorization: authorization }, signal: AbortSignal.timeout(5000), redirect: 'error',
    });
  } catch { throw failure('La base de conocimientos no está disponible. Intenta nuevamente.'); }
  if (response.status === 401) throw failure('Sesión expirada.', 401);
  if (response.status === 403) throw failure('Necesitas acceso a Tickets para consultar sus artículos.', 403);
  if (response.status === 404) throw failure('Artículo no disponible o sin publicar.', 404);
  if (!response.ok) throw failure('No se pudo consultar la base de conocimientos.');
  try {
    const body = await response.json();
    if (!body.success || body.data == null) throw new Error();
    return body.data;
  } catch { throw failure('Respuesta inválida de la base de conocimientos.'); }
}

export function articleSummary(article) {
  return {
    id: Number(article.id), title: article.title,
    snippet: String(article.snippet ?? article.body ?? '').slice(0, 200),
    category_name: article.category_name || null,
    href: `/tickets/knowledge-base?open=${encodeURIComponent(article.id)}`,
  };
}

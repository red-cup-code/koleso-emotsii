const valid = new Set(EMOTIONS.flatMap(([family, , , children]) => [
  family, ...children.flatMap(row => row.map(([key]) => key))
]));
const add = 'INSERT INTO emotion_counts (emotion, total) VALUES (?, 1) ON CONFLICT(emotion) DO UPDATE SET total = total + 1';
const list = 'SELECT emotion, total FROM emotion_counts ORDER BY total DESC, emotion ASC';
const receipt = 'INSERT INTO vote_submissions (id) VALUES (?) ON CONFLICT(id) DO NOTHING';
const addSelection = `
  INSERT INTO emotion_counts (emotion, total)
  SELECT value, 1 FROM json_each(?)
  WHERE EXISTS (SELECT 1 FROM vote_submissions WHERE id = ? AND recorded = 0)
  ON CONFLICT(emotion) DO UPDATE SET total = total + 1
`;
const recordReceipt = 'UPDATE vote_submissions SET recorded = 1 WHERE id = ? AND recorded = 0';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const asset = (body, type) => new Response(body, {
  headers:{'Content-Type':type, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache'}
});
const json = (body, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});

async function canResetStats(request, env) {
  if (env.PUBLIC_STATS_RESET === 'true') return true;
  const secret = env.STATS_RESET_TOKEN;
  const token = request.headers.get('X-Stats-Reset-Token');
  if (!secret || !token || token.length > 256) return false;
  const encode = value => new TextEncoder().encode(value);
  const [expected, supplied] = await Promise.all(
    [secret, token].map(value => crypto.subtle.digest('SHA-256', encode(value)))
  );
  const actual = new Uint8Array(supplied);
  return new Uint8Array(expected).reduce((diff, byte, index) => diff | (byte ^ actual[index]), 0) === 0;
}

async function vote(request, db, origin) {
  if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return json({error:'Forbidden'}, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Invalid content type'}, 415);
  const body = await request.text();
  if (body.length > 4096) return json({error:'Invalid vote'}, 400);
  const payload = JSON.parse(body);

  if (payload?.emotions === undefined && valid.has(payload?.emotion)) {
    await db.prepare(add).bind(payload.emotion).run();
    return json({ok:true});
  }

  const {emotions, submissionId} = payload ?? {};
  if (!Array.isArray(emotions) || emotions.length === 0 || emotions.length > valid.size ||
      !emotions.every(key => valid.has(key)) || typeof submissionId !== 'string' || !uuid.test(submissionId)) {
    return json({error:'Invalid vote'}, 400);
  }

  const uniqueEmotions = [...new Set(emotions)];
  await db.batch([
    db.prepare(receipt).bind(submissionId),
    db.prepare(addSelection).bind(JSON.stringify(uniqueEmotions), submissionId),
    db.prepare(recordReceipt).bind(submissionId)
  ]);
  return json({ok:true});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') {
      const isPublic = env.PUBLIC_STATS_RESET === 'true';
      let page = HTML;
      if (isPublic || env.STATS_RESET_TOKEN) page = page.replace('data-reset-disabled hidden', '');
      if (!isPublic && env.STATS_RESET_TOKEN) page = page.replace('data-reset-code hidden', 'data-reset-code');
      return new Response(page, {headers:{
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'
      }});
    }
    if (request.method === 'GET' && url.pathname === '/app.js') return asset(APP, 'text/javascript; charset=utf-8');
    try {
      if (request.method === 'GET' && url.pathname === '/api/stats') {
        const {results} = await env.DB.prepare(list).all();
        return json(results);
      }
      if (request.method === 'DELETE' && url.pathname === '/api/stats') {
        if (request.headers.get('Origin') !== url.origin || !await canResetStats(request, env)) {
          return json({error:'Forbidden'}, 403);
        }
        await env.DB.prepare('DELETE FROM emotion_counts').run();
        return json({ok:true});
      }
      if (request.method === 'POST' && url.pathname === '/api/vote') {
        return await vote(request, env.DB, url.origin);
      }
      return json({error:'Not found'}, 404);
    } catch (error) {
      if (error instanceof SyntaxError) return json({error:'Invalid JSON'}, 400);
      console.error('Data operation failed', error);
      return json({error:'Unable to access votes'}, 503);
    }
  }
};

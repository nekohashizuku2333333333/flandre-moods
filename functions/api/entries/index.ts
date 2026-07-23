import { isAuthenticated, jsonResponse, unauthorized, type Env } from '../../_lib/auth'
import { VALID_TIERS, type EntryRow } from '../../_lib/types'

// Reading entries is public by design — the homepage displays them to anyone
// without sign-in. Writing (below) still requires an authenticated admin session.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM entries ORDER BY date ASC').all<EntryRow>()
  return jsonResponse({ entries: results })
}

interface UpsertBody {
  metricId?: string
  date?: string
  tier?: string
  note?: string | null
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthenticated(request, env))) return unauthorized()

  let body: UpsertBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: '请求格式有误' }, { status: 400 })
  }

  if (!body.metricId || !body.date || !body.tier || !VALID_TIERS.has(body.tier)) {
    return jsonResponse({ error: '缺少必要字段(metricId、date、tier)' }, { status: 400 })
  }

  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO entries (metric_id, date, tier, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (metric_id, date)
     DO UPDATE SET tier = excluded.tier, note = excluded.note, updated_at = excluded.updated_at`,
  )
    .bind(body.metricId, body.date, body.tier, body.note ?? null, now, now)
    .run()

  const entry = await env.DB.prepare('SELECT * FROM entries WHERE metric_id = ? AND date = ?')
    .bind(body.metricId, body.date)
    .first<EntryRow>()

  return jsonResponse({ entry })
}

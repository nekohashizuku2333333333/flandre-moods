import { isAuthenticated, jsonResponse, unauthorized, type Env } from '../../_lib/auth'
import { DATE_PATTERN, METRIC_TIERS, TIME_PATTERN, type EntryRow } from '../../_lib/types'

// Reading entries is public by design — the homepage displays them to anyone
// without sign-in. Writing (below) still requires an authenticated admin session.
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    'SELECT * FROM entries ORDER BY date ASC, time ASC, id ASC',
  ).all<EntryRow>()
  return jsonResponse({ entries: results })
}

interface CreateBody {
  metricId?: string
  date?: string
  time?: string
  tier?: string
  note?: string | null
}

// A day holds as many check-ins as you make, so this always inserts a new row —
// correcting an earlier one goes through PATCH /api/entries/:id instead.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthenticated(request, env))) return unauthorized()

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: '请求格式有误' }, { status: 400 })
  }

  const { metricId, date, time, tier } = body
  const allowedTiers = metricId ? METRIC_TIERS[metricId] : undefined

  if (!metricId || !allowedTiers) {
    return jsonResponse({ error: '未知的记录项' }, { status: 400 })
  }
  if (!date || !DATE_PATTERN.test(date)) {
    return jsonResponse({ error: '日期格式有误(应为 YYYY-MM-DD)' }, { status: 400 })
  }
  if (!time || !TIME_PATTERN.test(time)) {
    return jsonResponse({ error: '时间格式有误(应为 HH:MM)' }, { status: 400 })
  }
  if (!tier || !allowedTiers.has(tier)) {
    return jsonResponse({ error: '无效的等级' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { meta } = await env.DB.prepare(
    `INSERT INTO entries (metric_id, date, time, tier, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(metricId, date, time, tier, body.note ?? null, now, now)
    .run()

  const entry = await env.DB.prepare('SELECT * FROM entries WHERE id = ?')
    .bind(meta.last_row_id)
    .first<EntryRow>()

  return jsonResponse({ entry })
}

import { isAuthenticated, jsonResponse, unauthorized, type Env } from '../../_lib/auth'
import { METRIC_TIERS, TIME_PATTERN, VALID_TIERS, type EntryRow } from '../../_lib/types'

interface UpdateBody {
  tier?: string
  time?: string
  note?: string | null
}

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!(await isAuthenticated(request, env))) return unauthorized()

  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return jsonResponse({ error: '无效的 id' }, { status: 400 })
  }

  let body: UpdateBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: '请求格式有误' }, { status: 400 })
  }

  const existing = await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first<EntryRow>()
  if (!existing) {
    return jsonResponse({ error: '未找到该记录' }, { status: 404 })
  }

  // Which grades are legal depends on the metric this row belongs to.
  const allowedTiers = METRIC_TIERS[existing.metric_id] ?? VALID_TIERS
  if (body.tier !== undefined && !allowedTiers.has(body.tier)) {
    return jsonResponse({ error: '无效的等级' }, { status: 400 })
  }
  if (body.time !== undefined && !TIME_PATTERN.test(body.time)) {
    return jsonResponse({ error: '时间格式有误(应为 HH:MM)' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const tier = body.tier ?? existing.tier
  const time = body.time ?? existing.time
  const note = body.note !== undefined ? body.note : existing.note

  await env.DB.prepare('UPDATE entries SET tier = ?, time = ?, note = ?, updated_at = ? WHERE id = ?')
    .bind(tier, time, note, now, id)
    .run()

  const entry = await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first<EntryRow>()
  return jsonResponse({ entry })
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!(await isAuthenticated(request, env))) return unauthorized()

  const id = Number(params.id)
  if (!Number.isInteger(id)) {
    return jsonResponse({ error: '无效的 id' }, { status: 400 })
  }

  const existing = await env.DB.prepare('SELECT id FROM entries WHERE id = ?').bind(id).first()
  if (!existing) {
    return jsonResponse({ error: '未找到该记录' }, { status: 404 })
  }

  await env.DB.prepare('DELETE FROM entries WHERE id = ?').bind(id).run()

  return jsonResponse({ ok: true })
}

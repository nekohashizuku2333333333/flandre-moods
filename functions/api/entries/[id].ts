import { isAuthenticated, jsonResponse, unauthorized, type Env } from '../../_lib/auth'
import { VALID_TIERS, type EntryRow } from '../../_lib/types'

interface UpdateBody {
  tier?: string
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

  if (body.tier !== undefined && !VALID_TIERS.has(body.tier)) {
    return jsonResponse({ error: '无效的状态取值' }, { status: 400 })
  }

  const existing = await env.DB.prepare('SELECT * FROM entries WHERE id = ?').bind(id).first<EntryRow>()
  if (!existing) {
    return jsonResponse({ error: '未找到该记录' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const tier = body.tier ?? existing.tier
  const note = body.note !== undefined ? body.note : existing.note

  await env.DB.prepare('UPDATE entries SET tier = ?, note = ?, updated_at = ? WHERE id = ?')
    .bind(tier, note, now, id)
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

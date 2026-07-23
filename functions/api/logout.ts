import { clearSessionCookieHeader, isHttpsRequest, jsonResponse } from '../_lib/auth'

export const onRequestPost: PagesFunction = async ({ request }) => {
  return jsonResponse({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookieHeader(isHttpsRequest(request)) } })
}

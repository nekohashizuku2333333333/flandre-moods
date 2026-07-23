import { isAuthenticated, jsonResponse, type Env } from '../_lib/auth'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authenticated = await isAuthenticated(request, env)
  return jsonResponse({ authenticated })
}

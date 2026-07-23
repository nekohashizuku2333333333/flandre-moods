import { useState, type FormEvent } from 'react'
import { login, ApiError } from './api'

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '出了点问题,请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">Smirnova 的身心健康</h1>
        <p className="login-subtitle">登录后继续。</p>
        <input
          type="password"
          className="login-input"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="login-submit button-primary" disabled={submitting || !password}>
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  )
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  metrics,
  metricById,
  goodPercent,
  dateForIndex,
  formatDateKey,
  parseDateKey,
  todayKey,
  type MetricConfig,
  type Tier,
  type DayStatus,
} from './data/metrics'
import { getSession, getEntries, upsertEntry, updateEntry, deleteEntry, logout, ApiError, type ApiEntry } from './api'
import { LoginScreen } from './LoginScreen'
import './App.css'

const MOBILE_BREAKPOINT = 640
const DESKTOP_MIN_WIDTH = 640
const DESKTOP_MAX_WIDTH = 1400
const MOBILE_DAYS = 30
const DESKTOP_MIN_DAYS = 60
const DESKTOP_MAX_DAYS = 90

const TIER_ORDER: Tier[] = ['good', 'okay', 'low', 'hard']

function computeVisibleDays(width: number): number {
  if (width < MOBILE_BREAKPOINT) return MOBILE_DAYS
  const t = Math.min(1, Math.max(0, (width - DESKTOP_MIN_WIDTH) / (DESKTOP_MAX_WIDTH - DESKTOP_MIN_WIDTH)))
  return Math.round(DESKTOP_MIN_DAYS + t * (DESKTOP_MAX_DAYS - DESKTOP_MIN_DAYS))
}

function useVisibleDays(): number {
  const [visibleDays, setVisibleDays] = useState(() => computeVisibleDays(window.innerWidth))

  useEffect(() => {
    function handleResize() {
      setVisibleDays(computeVisibleDays(window.innerWidth))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return visibleDays
}

const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatDayLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS_ZH[date.getDay()]}`
}

function formatFullDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

const todayLabel = formatDayLabel(new Date())

interface TooltipState {
  x: number
  y: number
  flip: boolean
  status: DayStatus
  date: Date
  label: string
  note: string | null
  metricTitle: string
}

function BarTooltip({ tooltip }: { tooltip: TooltipState }) {
  const ref = useRef<HTMLDivElement>(null)
  // tooltip.x is the true, unclamped center of the bar being pointed at. The
  // box itself gets clamped to stay on-screen, but the arrow stays glued to
  // tooltip.x so it keeps pointing at the actual bar even when the box shifts.
  const [box, setBox] = useState({ left: tooltip.x, arrowX: 0 })

  useLayoutEffect(() => {
    const width = ref.current?.offsetWidth ?? 0
    const margin = 8
    const half = width / 2
    const left = Math.min(Math.max(tooltip.x, half + margin), window.innerWidth - half - margin)
    const arrowX = Math.min(Math.max(tooltip.x - (left - half), 14), width - 14)
    setBox({ left, arrowX })
  }, [tooltip])

  return (
    <div
      ref={ref}
      className={`bar-tooltip${tooltip.flip ? ' bar-tooltip--flip' : ''}`}
      style={{ left: box.left, top: tooltip.y, '--arrow-x': `${box.arrowX}px` } as CSSProperties}
      role="tooltip"
    >
      <div className="bar-tooltip-date">{formatDayLabel(tooltip.date)}</div>
      {tooltip.status === 'none' ? (
        <div className="bar-tooltip-muted">未记录</div>
      ) : (
        <div className={`bar-tooltip-label state-${tooltip.status}`}>{tooltip.label}</div>
      )}
      {tooltip.note && <div className="bar-tooltip-note">{tooltip.note}</div>}
      <div className="bar-tooltip-metric">{tooltip.metricTitle}</div>
    </div>
  )
}

function Bar({
  status,
  date,
  label,
  note,
  metricTitle,
  onShow,
  onHide,
}: {
  status: DayStatus
  date: Date
  label: string
  note: string | null
  metricTitle: string
  onShow: (tooltip: TooltipState) => void
  onHide: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  function reveal() {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const flip = rect.top < 130
    const x = rect.left + rect.width / 2
    onShow({
      x,
      y: flip ? rect.bottom + 10 : rect.top - 10,
      flip,
      status,
      date,
      label,
      note,
      metricTitle,
    })
  }

  return (
    <span
      ref={ref}
      className={`bar bar-${status}`}
      tabIndex={0}
      role="button"
      aria-label={`${formatDayLabel(date)}:${status === 'none' ? '未记录' : label}`}
      onMouseEnter={reveal}
      onMouseLeave={onHide}
      onFocus={reveal}
      onBlur={onHide}
      onClick={(e) => {
        e.stopPropagation()
        reveal()
      }}
    />
  )
}

function TierSelect({
  metric,
  value,
  onChange,
}: {
  metric: MetricConfig
  value: Tier
  onChange: (tier: Tier) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="tier-select" ref={ref}>
      <button
        type="button"
        className={`tier-select-trigger state-${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {metric.currentLabel[value]}
        <svg className="tier-select-chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="tier-select-menu" role="listbox">
          {TIER_ORDER.map((t) => (
            <li key={t} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={t === value}
                className={`tier-select-option state-${t}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(t)
                  setOpen(false)
                }}
              >
                {metric.currentLabel[t]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CheckInForm({
  metric,
  todayEntry,
  onSave,
}: {
  metric: MetricConfig
  todayEntry?: ApiEntry
  onSave: (tier: Tier, note: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [tier, setTier] = useState<Tier>(todayEntry?.tier ?? 'good')
  const [note, setNote] = useState(todayEntry?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTier(todayEntry?.tier ?? 'good')
    setNote(todayEntry?.note ?? '')
  }, [todayEntry])

  if (!editing) {
    return (
      <div className="checkin-row">
        <button
          type="button"
          className="checkin-toggle"
          onClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          {todayEntry ? '编辑今天的记录' : '记录今天'}
        </button>
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await onSave(tier, note)
      setEditing(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败,请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="checkin-form" onClick={(e) => e.stopPropagation()}>
      <p className="checkin-label">选择今天的状态</p>
      <TierSelect metric={metric} value={tier} onChange={setTier} />
      <textarea
        className="checkin-note"
        placeholder="写点笔记(选填)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      {error && <p className="checkin-error">{error}</p>}
      <div className="checkin-actions">
        <button type="button" className="checkin-cancel" onClick={() => setEditing(false)}>
          取消
        </button>
        <button type="button" className="button-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

function MetricRow({
  metric,
  visibleDays,
  entryMap,
  canManage,
  onShowTooltip,
  onHideTooltip,
  onSaveCheckIn,
}: {
  metric: MetricConfig
  visibleDays: number
  entryMap: Map<string, ApiEntry>
  canManage: boolean
  onShowTooltip: (tooltip: TooltipState) => void
  onHideTooltip: () => void
  onSaveCheckIn: (tier: Tier, note: string) => Promise<void>
}) {
  const days = useMemo(() => {
    const list: { date: Date; status: DayStatus; entry?: ApiEntry }[] = []
    for (let i = 0; i < visibleDays; i++) {
      const date = dateForIndex(i, visibleDays)
      const entry = entryMap.get(`${metric.id}|${formatDateKey(date)}`)
      list.push({ date, status: entry ? entry.tier : 'none', entry })
    }
    return list
  }, [metric.id, visibleDays, entryMap])

  const todayEntry = entryMap.get(`${metric.id}|${todayKey()}`)
  const currentStatus: DayStatus = todayEntry ? todayEntry.tier : 'none'
  const percent = goodPercent(days.map((d) => d.status))

  return (
    <article className="metric-row">
      <div className="metric-head">
        <h2 className="metric-title">{metric.title}</h2>
        <span className={`metric-state state-${currentStatus === 'none' ? 'unlogged' : currentStatus}`}>
          {currentStatus === 'none' ? '未记录' : metric.currentLabel[currentStatus]}
        </span>
      </div>

      <div
        className="day-bars"
        role="img"
        aria-label={`${metric.title}:过去 ${days.length} 天的自我记录,最近一次是${
          currentStatus === 'none' ? '未记录' : metric.currentLabel[currentStatus]
        }`}
      >
        {days.map(({ date, status, entry }, i) => (
          <Bar
            key={i}
            status={status}
            date={date}
            label={status !== 'none' ? metric.currentLabel[status] : ''}
            note={entry?.note ?? null}
            metricTitle={metric.title}
            onShow={onShowTooltip}
            onHide={onHideTooltip}
          />
        ))}
      </div>

      <div className="metric-foot">
        <span className="foot-label">{visibleDays} 天前</span>
        <span className="foot-line" aria-hidden="true" />
        <span className="foot-stat">{percent === null ? '还没有记录' : `${percent.toFixed(1)}% 状态良好`}</span>
        <span className="foot-line" aria-hidden="true" />
        <span className="foot-label">今天</span>
      </div>

      {canManage && <CheckInForm metric={metric} todayEntry={todayEntry} onSave={onSaveCheckIn} />}
    </article>
  )
}

function LogEntryRow({
  entry,
  metricTitle,
  canManage,
  onSaveNote,
  onDelete,
}: {
  entry: ApiEntry
  metricTitle: string
  canManage: boolean
  onSaveNote?: (id: number, note: string) => Promise<void>
  onDelete?: (id: number) => Promise<void>
}) {
  const [note, setNote] = useState(entry.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const label = metricById(entry.metric_id)?.currentLabel[entry.tier] ?? entry.tier
  const dirty = note !== (entry.note ?? '')

  useEffect(() => {
    setNote(entry.note ?? '')
  }, [entry.note])

  async function handleSave() {
    if (!onSaveNote) return
    setSaving(true)
    setError(null)
    try {
      await onSaveNote(entry.id, note)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '保存失败,请重试。')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDelete(entry.id)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : '删除失败,请重试。')
      setDeleting(false)
    }
  }

  return (
    <div className="log-entry">
      <div className="log-entry-head">
        <span className={`log-entry-tier state-${entry.tier}`}>{label}</span>
        <span className="log-entry-metric">{metricTitle}</span>
      </div>
      {canManage ? (
        <div className="log-entry-note-edit">
          <textarea
            className="checkin-note"
            placeholder="写点笔记(选填)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          {error && <p className="checkin-error">{error}</p>}
          {deleteError && <p className="checkin-error">{deleteError}</p>}
          <div className="log-entry-note-actions">
            {confirmingDelete ? (
              <span className="log-entry-confirm">
                确定删除这条记录?
                <button
                  type="button"
                  className="log-entry-confirm-yes"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? '删除中…' : '删除'}
                </button>
                <button
                  type="button"
                  className="log-entry-confirm-no"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  取消
                </button>
              </span>
            ) : (
              <button type="button" className="log-entry-delete" onClick={() => setConfirmingDelete(true)}>
                删除
              </button>
            )}
            {dirty && (
              <button type="button" className="button-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
            )}
          </div>
        </div>
      ) : (
        entry.note && <p className="log-entry-note">{entry.note}</p>
      )}
    </div>
  )
}

function Dashboard({
  entries,
  entriesError,
  visibleDays,
  canManage,
  onLogout,
  onSaveCheckIn,
  onSaveNote,
  onDeleteEntry,
}: {
  entries: ApiEntry[]
  entriesError: string | null
  visibleDays: number
  canManage: boolean
  onLogout?: () => void
  onSaveCheckIn?: (metricId: string, tier: Tier, note: string) => Promise<void>
  onSaveNote?: (id: number, note: string) => Promise<void>
  onDeleteEntry?: (id: number) => Promise<void>
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setTooltip(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const entryMap = useMemo(() => {
    const map = new Map<string, ApiEntry>()
    for (const entry of entries) map.set(`${entry.metric_id}|${entry.date}`, entry)
    return map
  }, [entries])

  const logGroups = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    const map = new Map<string, ApiEntry[]>()
    for (const entry of sorted) {
      const key = formatFullDate(parseDateKey(entry.date))
      const group = map.get(key)
      if (group) group.push(entry)
      else map.set(key, [entry])
    }
    return Array.from(map.entries())
  }, [entries])

  return (
    <div className="page" onClick={() => setTooltip(null)}>
      <header className="topbar">
        <div className="brand">Smirnova 的身心健康</div>
        <div className="topbar-meta">
          <span className="today-date">{todayLabel}</span>
          {canManage && (
            <>
              <span className="topbar-divider" aria-hidden="true">
                ·
              </span>
              <button
                type="button"
                className="kicker-action"
                onClick={(e) => {
                  e.stopPropagation()
                  onLogout?.()
                }}
              >
                退出登录
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        {entriesError && <p className="entries-error">{entriesError}</p>}

        <section className="metric-list">
          {metrics.map((metric) => (
            <MetricRow
              key={metric.id}
              metric={metric}
              visibleDays={visibleDays}
              entryMap={entryMap}
              canManage={canManage}
              onShowTooltip={setTooltip}
              onHideTooltip={() => setTooltip(null)}
              onSaveCheckIn={(tier, note) => onSaveCheckIn!(metric.id, tier, note)}
            />
          ))}
        </section>

        <section className="logs">
          <h2 className="logs-title">记录</h2>
          {logGroups.length === 0 ? (
            <p className="logs-empty">还没有任何记录。</p>
          ) : (
            logGroups.map(([dateLabel, group]) => (
              <div className="log-group" key={dateLabel}>
                <h3 className="log-date">{dateLabel}</h3>
                <div className="log-entries">
                  {group.map((entry) => (
                    <LogEntryRow
                      key={entry.id}
                      entry={entry}
                      metricTitle={metricById(entry.metric_id)?.title ?? entry.metric_id}
                      canManage={canManage}
                      onSaveNote={onSaveNote}
                      onDelete={onDeleteEntry}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {tooltip && <BarTooltip tooltip={tooltip} />}
    </div>
  )
}

type AuthState = 'loading' | 'signed-out' | 'signed-in'

export function AdminApp() {
  const visibleDays = useVisibleDays()
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [entries, setEntries] = useState<ApiEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    getSession()
      .then((res) => setAuthState(res.authenticated ? 'signed-in' : 'signed-out'))
      .catch(() => setAuthState('signed-out'))
  }, [])

  useEffect(() => {
    if (authState !== 'signed-in') return
    getEntries()
      .then((res) => {
        setEntries(res.entries)
        setEntriesError(null)
      })
      .catch((err) => setEntriesError(err instanceof ApiError ? err.message : '加载记录失败'))
  }, [authState])

  async function handleSaveCheckIn(metricId: string, tier: Tier, note: string) {
    const { entry } = await upsertEntry({ metricId, date: todayKey(), tier, note: note.trim() || null })
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id)
      if (idx === -1) return [...prev, entry]
      const next = [...prev]
      next[idx] = entry
      return next
    })
  }

  async function handleUpdateNote(id: number, note: string) {
    const { entry } = await updateEntry(id, { note: note.trim() || null })
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)))
  }

  async function handleDeleteEntry(id: number) {
    await deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleLogout() {
    await logout().catch(() => {})
    setEntries([])
    setAuthState('signed-out')
  }

  if (authState === 'loading') {
    return <div className="page login-page" aria-busy="true" />
  }

  if (authState === 'signed-out') {
    return <LoginScreen onSuccess={() => setAuthState('signed-in')} />
  }

  return (
    <Dashboard
      entries={entries}
      entriesError={entriesError}
      visibleDays={visibleDays}
      canManage
      onLogout={handleLogout}
      onSaveCheckIn={handleSaveCheckIn}
      onSaveNote={handleUpdateNote}
      onDeleteEntry={handleDeleteEntry}
    />
  )
}

export function PublicApp() {
  const visibleDays = useVisibleDays()
  const [loaded, setLoaded] = useState(false)
  const [entries, setEntries] = useState<ApiEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    getEntries()
      .then((res) => {
        setEntries(res.entries)
        setEntriesError(null)
      })
      .catch((err) => setEntriesError(err instanceof ApiError ? err.message : '加载记录失败'))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) {
    return <div className="page login-page" aria-busy="true" />
  }

  return <Dashboard entries={entries} entriesError={entriesError} visibleDays={visibleDays} canManage={false} />
}

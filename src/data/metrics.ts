export type Tier = 'good' | 'okay' | 'low' | 'hard'
export type DayStatus = Tier | 'none'

export interface MetricConfig {
  id: string
  title: string
  currentLabel: Record<Tier, string>
}

export const metrics: MetricConfig[] = [
  {
    id: 'mood',
    title: '心情',
    currentLabel: { good: '感觉不错', okay: '还过得去', low: '有点低落', hard: '很难熬' },
  },
  {
    id: 'suicidal-ideation',
    title: '自杀意念',
    currentLabel: {
      good: '今天没有',
      okay: '偶尔闪过',
      low: '持续出现',
      hard: '正处于危机',
    },
  },
]

export function metricById(id: string): MetricConfig | undefined {
  return metrics.find((m) => m.id === id)
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateForIndex(index: number, totalDays: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (totalDays - 1 - index))
  return date
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayKey(): string {
  return formatDateKey(new Date())
}

export function goodPercent(statuses: DayStatus[]): number | null {
  const logged = statuses.filter((s): s is Tier => s !== 'none')
  if (logged.length === 0) return null
  const score = logged.reduce((sum, tier) => {
    if (tier === 'good') return sum + 1
    if (tier === 'okay') return sum + 0.75
    if (tier === 'low') return sum + 0.35
    return sum
  }, 0)
  return (score / logged.length) * 100
}

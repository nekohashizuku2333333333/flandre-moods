export type Tier = 'good' | 'okay' | 'low' | 'hard'

export const VALID_TIERS: ReadonlySet<string> = new Set(['good', 'okay', 'low', 'hard'])

export interface EntryRow {
  id: number
  metric_id: string
  date: string
  tier: Tier
  note: string | null
  created_at: string
  updated_at: string
}

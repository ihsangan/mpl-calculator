export interface Team {
  id: string
  name: string
  logo: string
  logoDark?: string
}

export interface Match {
  id: string
  teamA: string
  teamB: string
  scoreA: number
  scoreB: number
  date?: string
  postponed?: boolean
}

export interface TeamRow {
  id: string
  name: string
  matchW: number
  matchL: number
  gameW: number
  gameL: number
  diff: number
  pts: number
  winrate: string
}

export interface Probability {
  top2: string
  playoffs: string
  eliminated: string
  totalPlayoffs: string
  /**
   * Certainty flags derived from raw simulation counts, not the rounded
   * percentage strings. A value like "100.00" can come from 99.995% and must
   * not be read as mathematically guaranteed.
   */
  top2Clinched: boolean
  playoffsClinched: boolean
  eliminatedOut: boolean
}

export interface LeagueConfig {
  id: string
  name: string
  leagueName: string
  currentWeek: number
  allMatches: Match[]
  teams: Team[]
}

export interface ExportData {
  leagueId: string
  matches: Match[]
  selectedWeek: number | "ALL"
  timestamp: string
  iterations?: number
}

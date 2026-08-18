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
}

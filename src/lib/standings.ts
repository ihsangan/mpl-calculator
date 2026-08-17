import type { Match, Team, TeamRow } from "../types"

// Extract week number from match ID (e.g., "w8m1" -> 8 or "w1d2m1" -> 1)
export const getWeekFromId = (id: string): number => {
  const match = id.match(/w(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// Extract day number from match ID (e.g., "w1d2m1" -> 2)
export const getDayFromId = (id: string): number => {
  const match = id.match(/d(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// Extract match number from match ID (e.g., "w1d2m1" -> 1)
export const getMatchNumberFromId = (id: string): number => {
  const match = id.match(/m(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

// Check if match has been played (any non-zero score)
export const isMatchPlayed = (match: Match): boolean => {
  return match.scoreA !== 0 || match.scoreB !== 0
}

// Sort matches by ID (e.g., w1d1m1, w1d1m2, ..., w9d3m3)
export const sortMatchesById = (matches: Match[]): Match[] => {
  return [...matches].sort((a, b) => {
    const aWeek = getWeekFromId(a.id)
    const bWeek = getWeekFromId(b.id)
    if (aWeek !== bWeek) return aWeek - bWeek
    const aDay = getDayFromId(a.id)
    const bDay = getDayFromId(b.id)
    if (aDay !== bDay) return aDay - bDay
    const aMatch = getMatchNumberFromId(a.id)
    const bMatch = getMatchNumberFromId(b.id)
    return aMatch - bMatch
  })
}

export const getTeamLogo = (
  teamId: string,
  isDarkMode: boolean,
  teams: Team[]
): string => {
  const team = teams.find((t) => t.id === teamId)
  if (!team) return ""
  if (isDarkMode && team.logoDark) {
    return team.logoDark
  }
  return team.logo
}

export const getScheduleTeamName = (teamId: string): string => {
  if (teamId === "RRQT") return "RRQ"
  if (teamId === "ONPH") return "ONIC"
  return teamId
}

export const formatProbability = (value: string | number): string => {
  const num = typeof value === "string" ? Number(value) : value
  if (num === 100) return "100"
  if (num === 0) return "0"
  return num.toFixed(2)
}

export const calculateStandings = (
  matches: Match[],
  teams: Team[]
): TeamRow[] => {
  const table: Record<string, TeamRow> = {}

  teams.forEach((t) => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      matchW: 0,
      matchL: 0,
      gameW: 0,
      gameL: 0,
      diff: 0,
      pts: 0,
      winrate: "0",
    }
  })

  // Build H2H records: h2hWins[A][B] and h2hGameDiff[A][B]
  const h2hWins: Record<string, Record<string, number>> = {}
  const h2hGameDiff: Record<string, Record<string, number>> = {}
  teams.forEach((t) => {
    h2hWins[t.id] = {}
    h2hGameDiff[t.id] = {}
    teams.forEach((t2) => {
      h2hWins[t.id][t2.id] = 0
      h2hGameDiff[t.id][t2.id] = 0
    })
  })

  matches.forEach((m) => {
    if (!isMatchPlayed(m)) return
    // Guard against invalid team IDs (e.g. malformed import)
    if (!table[m.teamA] || !table[m.teamB]) return

    table[m.teamA].gameW += m.scoreA
    table[m.teamA].gameL += m.scoreB
    table[m.teamB].gameW += m.scoreB
    table[m.teamB].gameL += m.scoreA

    if (h2hGameDiff[m.teamA] && h2hGameDiff[m.teamB]) {
      h2hGameDiff[m.teamA][m.teamB] += m.scoreA - m.scoreB
      h2hGameDiff[m.teamB][m.teamA] += m.scoreB - m.scoreA
    }

    if (m.scoreA > m.scoreB) {
      table[m.teamA].matchW += 1
      table[m.teamB].matchL += 1
      table[m.teamA].pts += 1
      if (h2hWins[m.teamA]) h2hWins[m.teamA][m.teamB] += 1
    } else if (m.scoreB > m.scoreA) {
      table[m.teamB].matchW += 1
      table[m.teamA].matchL += 1
      table[m.teamB].pts += 1
      if (h2hWins[m.teamB]) h2hWins[m.teamB][m.teamA] += 1
    }
  })

  Object.values(table).forEach((team) => {
    team.diff = team.gameW - team.gameL
    const totalGames = team.gameW + team.gameL
    team.winrate =
      totalGames > 0 ? ((team.gameW / totalGames) * 100).toFixed(0) : "0"
  })

  return Object.values(table).sort((a, b) => {
    // 1. Match wins / Points
    if (b.matchW !== a.matchW) return b.matchW - a.matchW
    // 2. Net Game difference
    if (b.diff !== a.diff) return b.diff - a.diff
    // 3. Head-to-head match wins tiebreaker
    if (h2hWins[a.id] && h2hWins[b.id]) {
      const aWinsVsB = h2hWins[a.id][b.id] ?? 0
      const bWinsVsA = h2hWins[b.id][a.id] ?? 0
      if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB

      // 4. Head-to-head game difference tiebreaker
      const aNetVsB = h2hGameDiff[a.id]?.[b.id] ?? 0
      const bNetVsA = h2hGameDiff[b.id]?.[a.id] ?? 0
      if (aNetVsB !== bNetVsA) return bNetVsA - aNetVsB
    }
    // 5. Fallback: alphabetical
    return a.name.localeCompare(b.name)
  })
}

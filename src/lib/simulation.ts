import type { Match, Team, Probability } from "../types"
import { calculateStandings, isMatchPlayed } from "./standings"
import { calculateTeamElos, simulateBo3Match } from "./elo"

export type SimulationMode = "uniform" | "elo"

const POSSIBLE_SCORES = [
  { a: 2, b: 0 },
  { a: 2, b: 1 },
  { a: 1, b: 2 },
  { a: 0, b: 2 },
]

export const runMonteCarloSimulation = (
  matches: Match[],
  teams: Team[],
  iterations: number,
  mode: SimulationMode = "uniform"
): Record<string, Probability> => {
  const stats: Record<
    string,
    { top2: number; lowerBracket: number; eliminated: number }
  > = {}

  teams.forEach((t) => {
    stats[t.id] = { top2: 0, lowerBracket: 0, eliminated: 0 }
  })

  const played = matches.filter((m) => isMatchPlayed(m))
  const unplayed = matches.filter((m) => !isMatchPlayed(m))

  // If there are no unplayed matches, calculate exact standing once
  if (unplayed.length === 0) {
    const finalStandings = calculateStandings(matches, teams)
    const result: Record<string, Probability> = {}
    finalStandings.forEach((team, idx) => {
      const rank = idx + 1
      const isTop2 = rank <= 2
      const isLower = rank > 2 && rank <= 6
      const isElim = rank > 6
      result[team.id] = {
        top2: isTop2 ? "100.00" : "0.00",
        playoffs: isLower ? "100.00" : "0.00",
        totalPlayoffs: isTop2 || isLower ? "100.00" : "0.00",
        eliminated: isElim ? "100.00" : "0.00",
      }
    })
    return result
  }

  // Pre-calculate team ELOs if ELO mode is active
  const teamElos =
    mode === "elo" ? calculateTeamElos(played, teams) : null

  const unplayedLen = unplayed.length
  const possibleLen = POSSIBLE_SCORES.length

  for (let i = 0; i < iterations; i++) {
    const simMatches: Match[] = new Array(unplayedLen)
    for (let j = 0; j < unplayedLen; j++) {
      const uMatch = unplayed[j]
      let scoreA = 0
      let scoreB = 0

      if (mode === "elo" && teamElos) {
        const eloA = teamElos[uMatch.teamA] ?? 1500
        const eloB = teamElos[uMatch.teamB] ?? 1500
        const simRes = simulateBo3Match(eloA, eloB)
        scoreA = simRes.scoreA
        scoreB = simRes.scoreB
      } else {
        const score = POSSIBLE_SCORES[Math.floor(Math.random() * possibleLen)]
        scoreA = score.a
        scoreB = score.b
      }

      simMatches[j] = {
        id: uMatch.id,
        teamA: uMatch.teamA,
        teamB: uMatch.teamB,
        scoreA,
        scoreB,
      }
    }

    const simStandings = calculateStandings([...played, ...simMatches], teams)
    simStandings.forEach((team, index) => {
      const rank = index + 1
      if (rank <= 2) {
        stats[team.id].top2++
      } else if (rank <= 6) {
        stats[team.id].lowerBracket++
      } else {
        stats[team.id].eliminated++
      }
    })
  }

  const result: Record<string, Probability> = {}
  Object.keys(stats).forEach((id) => {
    const top2Pct = (stats[id].top2 / iterations) * 100
    const lowerPct = (stats[id].lowerBracket / iterations) * 100
    const totalPlayoffPct = top2Pct + lowerPct
    const elimPct = (stats[id].eliminated / iterations) * 100

    result[id] = {
      top2: top2Pct.toFixed(2),
      playoffs: lowerPct.toFixed(2),
      totalPlayoffs: totalPlayoffPct.toFixed(2),
      eliminated: elimPct.toFixed(2),
    }
  })

  return result
}

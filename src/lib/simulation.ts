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
  mode: SimulationMode = "uniform",
  pointSystem: "standard" | "three_point" = "standard",
  skipSweep = false
): Record<string, Probability> => {
  const stats: Record<
    string,
    {
      top2: number
      lowerBracket: number
      eliminated: number
      bestRank: number
      worstRank: number
    }
  > = {}

  teams.forEach((t) => {
    stats[t.id] = {
      top2: 0,
      lowerBracket: 0,
      eliminated: 0,
      bestRank: teams.length,
      worstRank: 1,
    }
  })

  const played = matches.filter((m) => isMatchPlayed(m))
  const unplayed = matches.filter((m) => !isMatchPlayed(m))

  // If there are no unplayed matches, calculate exact standing once
  if (unplayed.length === 0) {
    const finalStandings = calculateStandings(matches, teams, pointSystem)
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
        top2Clinched: isTop2,
        playoffsClinched: isTop2 || isLower,
        eliminatedOut: isElim,
        bestRank: rank,
        worstRank: rank,
      }
    })
    return result
  }

  // Pre-calculate team ELOs if ELO mode is active
  const teamElos = mode === "elo" ? calculateTeamElos(played, teams) : null

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

    const simStandings = calculateStandings(
      [...played, ...simMatches],
      teams,
      pointSystem
    )
    simStandings.forEach((team, index) => {
      const rank = index + 1
      if (rank < stats[team.id].bestRank) {
        stats[team.id].bestRank = rank
      }
      if (rank > stats[team.id].worstRank) {
        stats[team.id].worstRank = rank
      }
      if (rank <= 2) {
        stats[team.id].top2++
      } else if (rank <= 6) {
        stats[team.id].lowerBracket++
      } else {
        stats[team.id].eliminated++
      }
    })
  }

  // Targeted boundary sweep for each team to catch rare extreme rank possibilities
  if (!skipSweep && unplayedLen > 0) {
    const SWEEPS = [
      { a: 2, b: 0 },
      { a: 0, b: 2 },
    ]
    const targetedIters = Math.min(
      300,
      Math.max(100, Math.floor(iterations / 4))
    )

    teams.forEach((t) => {
      const otherMatches = unplayed.filter(
        (m) => m.teamA !== t.id && m.teamB !== t.id
      )
      const otherMatchBits = unplayed.map((u) =>
        otherMatches.findIndex((x) => x.id === u.id)
      )

      // Systematic sweep combinations when search space is <= 1024 (<= 10 non-target matches)
      if (otherMatches.length <= 10) {
        const totalComb = 1 << otherMatches.length
        const simMatches: Match[] = new Array(unplayedLen)
        for (let j = 0; j < unplayedLen; j++) {
          const u = unplayed[j]
          simMatches[j] = {
            id: u.id,
            teamA: u.teamA,
            teamB: u.teamB,
            scoreA: 0,
            scoreB: 0,
          }
        }

        // Best rank search
        for (let mask = 0; mask < totalComb; mask++) {
          for (let j = 0; j < unplayedLen; j++) {
            const u = unplayed[j]
            if (u.teamA === t.id) {
              simMatches[j].scoreA = 2
              simMatches[j].scoreB = 0
            } else if (u.teamB === t.id) {
              simMatches[j].scoreA = 0
              simMatches[j].scoreB = 2
            } else {
              const bit = otherMatchBits[j]
              const winA = ((mask >> bit) & 1) === 1
              simMatches[j].scoreA = winA ? 2 : 0
              simMatches[j].scoreB = winA ? 0 : 2
            }
          }
          const st = calculateStandings(
            [...played, ...simMatches],
            teams,
            pointSystem
          )
          const rank = st.findIndex((item) => item.id === t.id) + 1
          if (rank < stats[t.id].bestRank) {
            stats[t.id].bestRank = rank
          }
          if (stats[t.id].bestRank === 1) break
        }

        // Worst rank search
        for (let mask = 0; mask < totalComb; mask++) {
          for (let j = 0; j < unplayedLen; j++) {
            const u = unplayed[j]
            if (u.teamA === t.id) {
              simMatches[j].scoreA = 0
              simMatches[j].scoreB = 2
            } else if (u.teamB === t.id) {
              simMatches[j].scoreA = 2
              simMatches[j].scoreB = 0
            } else {
              const bit = otherMatchBits[j]
              const winA = ((mask >> bit) & 1) === 1
              simMatches[j].scoreA = winA ? 2 : 0
              simMatches[j].scoreB = winA ? 0 : 2
            }
          }
          const st = calculateStandings(
            [...played, ...simMatches],
            teams,
            pointSystem
          )
          const rank = st.findIndex((item) => item.id === t.id) + 1
          if (rank > stats[t.id].worstRank) {
            stats[t.id].worstRank = rank
          }
          if (stats[t.id].worstRank === teams.length) break
        }
      } else {
        // Randomized sweeps & score samples for larger search space
        for (let k = 0; k < targetedIters; k++) {
          const simMatchesB: Match[] = new Array(unplayedLen)
          const simMatchesW: Match[] = new Array(unplayedLen)
          for (let j = 0; j < unplayedLen; j++) {
            const uMatch = unplayed[j]
            const sc =
              k % 2 === 0
                ? SWEEPS[Math.floor(Math.random() * 2)]
                : POSSIBLE_SCORES[Math.floor(Math.random() * possibleLen)]

            if (uMatch.teamA === t.id) {
              simMatchesB[j] = { ...uMatch, scoreA: 2, scoreB: 0 }
              simMatchesW[j] = { ...uMatch, scoreA: 0, scoreB: 2 }
            } else if (uMatch.teamB === t.id) {
              simMatchesB[j] = { ...uMatch, scoreA: 0, scoreB: 2 }
              simMatchesW[j] = { ...uMatch, scoreA: 2, scoreB: 0 }
            } else {
              simMatchesB[j] = { ...uMatch, scoreA: sc.a, scoreB: sc.b }
              simMatchesW[j] = { ...uMatch, scoreA: sc.a, scoreB: sc.b }
            }
          }
          const rankB =
            calculateStandings(
              [...played, ...simMatchesB],
              teams,
              pointSystem
            ).findIndex((item) => item.id === t.id) + 1
          if (rankB < stats[t.id].bestRank) stats[t.id].bestRank = rankB
          if (
            stats[t.id].bestRank === 1 &&
            stats[t.id].worstRank === teams.length
          )
            break

          const rankW =
            calculateStandings(
              [...played, ...simMatchesW],
              teams,
              pointSystem
            ).findIndex((item) => item.id === t.id) + 1
          if (rankW > stats[t.id].worstRank) stats[t.id].worstRank = rankW
        }
      }
    })
  }

  const result: Record<string, Probability> = {}
  Object.keys(stats).forEach((id) => {
    const { top2, lowerBracket, eliminated, bestRank, worstRank } = stats[id]
    const top2Pct = (top2 / iterations) * 100
    const lowerPct = (lowerBracket / iterations) * 100
    const totalPlayoffPct = top2Pct + lowerPct
    const elimPct = (eliminated / iterations) * 100

    result[id] = {
      top2: top2Pct.toFixed(2),
      playoffs: lowerPct.toFixed(2),
      totalPlayoffs: totalPlayoffPct.toFixed(2),
      eliminated: elimPct.toFixed(2),
      // Mathematical certainty: requires both Monte Carlo consistency and
      // verified rank bounds to prevent false flags at low iterations.
      top2Clinched: iterations > 0 && worstRank <= 2 && top2 === iterations,
      playoffsClinched:
        iterations > 0 && worstRank <= 6 && top2 + lowerBracket === iterations,
      eliminatedOut:
        iterations > 0 && bestRank > 6 && eliminated === iterations,
      bestRank,
      worstRank,
    }
  })

  return result
}

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

/**
 * Certified outer bounds on each team's final regular-season rank.
 *
 * The returned range is guaranteed to contain the true best/worst achievable
 * rank, because it only compares the primary sort key (match wins, or points
 * under the three-point system) and treats every remaining match as free to be
 * won or lost by either side. Since unplayed matches can only add to a team's
 * primary tally, the current tally is a valid lower bound and the tally plus
 * the maximum per-match gain is a valid upper bound.
 *
 * This replaces an earlier bound search that enumerated 2-0/0-2 scorelines
 * (capped at 2^10 combinations) and fell back to randomized sampling beyond
 * that. Both paths were unsound: they ignored 2-1 results, which change the
 * three-point tally and the game differential used by the tiebreakers, and the
 * randomized path could miss extreme outcomes entirely. That produced false
 * certainty badges, such as a CLINCHED label for a team that could still miss
 * the playoffs.
 *
 * These bounds are deliberately conservative: they may miss a certainty rather
 * than invent one, so a badge is only ever shown when it is provably correct.
 */
export const computeCertifiedRankBounds = (
  teams: Team[],
  matches: Match[],
  pointSystem: "standard" | "three_point" = "standard"
): Record<string, { bestRank: number; worstRank: number }> => {
  const played = matches.filter((m) => isMatchPlayed(m))
  const unplayed = matches.filter((m) => !isMatchPlayed(m))
  const base = calculateStandings(played, teams, pointSystem)

  const primaryOf = (id: string): number => {
    const row = base.find((r) => r.id === id)
    if (!row) return 0
    return pointSystem === "three_point" ? row.pts : row.matchW
  }

  // Maximum primary-key gain available from a single remaining match.
  const maxGainPerMatch = pointSystem === "three_point" ? 3 : 1

  const remaining: Record<string, number> = {}
  teams.forEach((t) => {
    remaining[t.id] = 0
  })
  unplayed.forEach((m) => {
    if (remaining[m.teamA] !== undefined) remaining[m.teamA] += 1
    if (remaining[m.teamB] !== undefined) remaining[m.teamB] += 1
  })

  const bounds: Record<string, { bestRank: number; worstRank: number }> = {}

  teams.forEach((t) => {
    const tMin = primaryOf(t.id)
    const tMax = tMin + remaining[t.id] * maxGainPerMatch

    let guaranteedAbove = 0
    let maybeAbove = 0

    teams.forEach((u) => {
      if (u.id === t.id) return
      const uMin = primaryOf(u.id)
      const uMax = uMin + remaining[u.id] * maxGainPerMatch

      // A tally can never decrease, so beating tMax means u always finishes
      // ahead of t no matter how the remaining matches fall.
      if (uMin > tMax) guaranteedAbove += 1
      // uMax can still reach tMin, so u might finish ahead on a tiebreaker.
      if (uMax >= tMin) maybeAbove += 1
    })

    bounds[t.id] = {
      bestRank: 1 + guaranteedAbove,
      worstRank: 1 + maybeAbove,
    }
  })

  return bounds
}

interface SimulationStats {
  [teamId: string]: {
    top2: number
    lowerBracket: number
    eliminated: number
  }
}

const createStats = (teams: Team[]): SimulationStats => {
  const stats: SimulationStats = {}
  teams.forEach((t) => {
    stats[t.id] = { top2: 0, lowerBracket: 0, eliminated: 0 }
  })
  return stats
}

/**
 * Run `count` simulated seasons, accumulating finish counts into `stats`.
 *
 * Extracted so the synchronous and chunked entry points share one
 * implementation, keeping their results identical.
 */
const accumulateIterations = (
  count: number,
  stats: SimulationStats,
  played: Match[],
  unplayed: Match[],
  teams: Team[],
  mode: SimulationMode,
  teamElos: Record<string, number> | null,
  pointSystem: "standard" | "three_point"
): void => {
  const unplayedLen = unplayed.length
  const possibleLen = POSSIBLE_SCORES.length

  for (let i = 0; i < count; i++) {
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
      if (rank <= 2) {
        stats[team.id].top2++
      } else if (rank <= 6) {
        stats[team.id].lowerBracket++
      } else {
        stats[team.id].eliminated++
      }
    })
  }
}

const buildResult = (
  stats: SimulationStats,
  teams: Team[],
  matches: Match[],
  iterations: number,
  pointSystem: "standard" | "three_point"
): Record<string, Probability> => {
  // Certified outer bounds on each team's final rank. These are sound, so a
  // certainty badge is only ever shown when it is provably correct.
  const bounds = computeCertifiedRankBounds(teams, matches, pointSystem)

  const result: Record<string, Probability> = {}
  Object.keys(stats).forEach((id) => {
    const { top2, lowerBracket, eliminated } = stats[id]
    const { bestRank, worstRank } = bounds[id] ?? {
      bestRank: teams.length,
      worstRank: 1,
    }
    const top2Pct = (top2 / iterations) * 100
    const lowerPct = (lowerBracket / iterations) * 100
    const totalPlayoffPct = top2Pct + lowerPct
    const elimPct = (eliminated / iterations) * 100

    result[id] = {
      top2: top2Pct.toFixed(2),
      playoffs: lowerPct.toFixed(2),
      totalPlayoffs: totalPlayoffPct.toFixed(2),
      eliminated: elimPct.toFixed(2),
      // Mathematical certainty: the certified rank bounds must prove the
      // outcome outright. The Monte Carlo agreement check is retained as a
      // cross-check so a bug in either path cannot silently assert certainty.
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

export const runMonteCarloSimulation = (
  matches: Match[],
  teams: Team[],
  iterations: number,
  mode: SimulationMode = "uniform",
  pointSystem: "standard" | "three_point" = "standard"
): Record<string, Probability> => {
  const stats = createStats(teams)

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

  accumulateIterations(
    iterations,
    stats,
    played,
    unplayed,
    teams,
    mode,
    teamElos,
    pointSystem
  )

  return buildResult(stats, teams, matches, iterations, pointSystem)
}

/**
 * Chunked simulation for the main-thread fallback.
 *
 * A Worker is preferred, but when one cannot be created the fallback previously
 * ran the entire loop synchronously, freezing the tab for the full duration
 * (tens of seconds at high iteration counts). This variant runs the same
 * iterations in slices and yields to the event loop between them, so the UI
 * stays responsive and `shouldCancel` can abandon an obsolete run.
 *
 * Returns `null` if the run was cancelled before completing.
 */
export const runMonteCarloSimulationAsync = async (
  matches: Match[],
  teams: Team[],
  iterations: number,
  mode: SimulationMode = "uniform",
  pointSystem: "standard" | "three_point" = "standard",
  options: { chunkSize?: number; shouldCancel?: () => boolean } = {}
): Promise<Record<string, Probability> | null> => {
  const { chunkSize = 250, shouldCancel } = options

  const played = matches.filter((m) => isMatchPlayed(m))
  const unplayed = matches.filter((m) => !isMatchPlayed(m))

  if (unplayed.length === 0) {
    return runMonteCarloSimulation(matches, teams, 0, mode, pointSystem)
  }

  const stats = createStats(teams)
  const teamElos = mode === "elo" ? calculateTeamElos(played, teams) : null

  let completed = 0
  while (completed < iterations) {
    if (shouldCancel?.()) return null

    const slice = Math.min(chunkSize, iterations - completed)
    accumulateIterations(
      slice,
      stats,
      played,
      unplayed,
      teams,
      mode,
      teamElos,
      pointSystem
    )
    completed += slice

    // Yield so rendering, input, and cancellation can be processed.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  if (shouldCancel?.()) return null

  return buildResult(stats, teams, matches, iterations, pointSystem)
}

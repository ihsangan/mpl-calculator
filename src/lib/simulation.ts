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
 * Compute the maximum number of competitors that can finish with at least
 * `tMin` match wins, where `tMin` is the target's tally when it loses every
 * remaining match.
 *
 * Modeled after the classical Baseball Elimination network flow (Wayne 1999).
 * Each remaining match is a unit of capacity that can credit exactly one
 * winner, so mutual opponents cannot both be counted as winning their fixture.
 *
 * The target is assumed to lose all of its remaining matches, which is the
 * adversary's best case for the target's rank: every defeat hands a win to the
 * opponent while the target stays at `tMin`. Matches involving the target are
 * therefore kept in the network but can only credit the opponent. Non-subset
 * teams deliberately have no edge to the sink: a win for them would consume
 * match capacity without helping the subset reach `tMin`.
 *
 * A subset is feasible when its total required wins can be routed through
 * distinct remaining matches; the answer is the largest feasible subset, plus
 * the competitors already at or above `tMin`.
 */
function maxCompetitorsReachingWins(
  targetTeamId: string,
  tMin: number,
  teams: Team[],
  baseWins: Map<string, number>,
  unplayed: Match[]
): number {
  const candidates: Array<{ id: string; needed: number }> = []
  let already = 0

  for (const u of teams) {
    if (u.id === targetTeamId) continue
    const uWins = baseWins.get(u.id) ?? 0
    if (uWins >= tMin) {
      already += 1
      continue
    }
    const uRem = unplayed.filter(
      (m) => m.teamA === u.id || m.teamB === u.id
    ).length
    if (uWins + uRem >= tMin) {
      candidates.push({ id: u.id, needed: tMin - uWins })
    }
  }

  if (candidates.length === 0) return already

  const M = unplayed.length
  const teamIdx = new Map(teams.map((t, i) => [t.id, i]))
  const S = 0
  const T = M + teams.length + 1

  function canSubsetAchieve(
    subset: Array<{ id: string; needed: number }>
  ): boolean {
    const totalNeeded = subset.reduce((acc, c) => acc + c.needed, 0)
    const cap: number[][] = Array.from({ length: T + 1 }, () =>
      Array(T + 1).fill(0)
    )
    const adj: number[][] = Array.from({ length: T + 1 }, () => [])

    function addEdge(u: number, v: number, c: number) {
      cap[u][v] += c
      adj[u].push(v)
      adj[v].push(u)
    }

    unplayed.forEach((m, i) => {
      const mNode = 1 + i
      addEdge(S, mNode, 1)
      // The target always loses, so its matches can only credit the opponent.
      if (m.teamA !== targetTeamId) {
        const uIdx = teamIdx.get(m.teamA)
        if (uIdx !== undefined) addEdge(mNode, M + 1 + uIdx, 1)
      }
      if (m.teamB !== targetTeamId) {
        const vIdx = teamIdx.get(m.teamB)
        if (vIdx !== undefined) addEdge(mNode, M + 1 + vIdx, 1)
      }
    })

    // Only subset teams need wins. Everyone else gets no sink edge, because a
    // win for them cannot help the subset reach `tMin`.
    const subsetMap = new Map(subset.map((c) => [c.id, c.needed]))
    teams.forEach((t, i) => {
      const neededWins = subsetMap.get(t.id)
      if (neededWins !== undefined) {
        addEdge(M + 1 + i, T, neededWins)
      }
    })

    let flow = 0
    while (true) {
      const parent = Array(T + 1).fill(-1)
      const queue = [S]
      parent[S] = S
      while (queue.length > 0 && parent[T] === -1) {
        const u = queue.shift()!
        for (const v of adj[u]) {
          if (parent[v] === -1 && cap[u][v] > 0) {
            parent[v] = u
            queue.push(v)
          }
        }
      }
      if (parent[T] === -1) break

      let push = Infinity
      for (let v = T; v !== S; v = parent[v]) {
        const u = parent[v]
        push = Math.min(push, cap[u][v])
      }
      for (let v = T; v !== S; v = parent[v]) {
        const u = parent[v]
        cap[u][v] -= push
        cap[v][u] += push
      }
      flow += push
    }

    return flow >= totalNeeded
  }

  function* combinations<T>(
    arr: T[],
    k: number,
    start = 0,
    current: T[] = []
  ): Generator<T[]> {
    if (current.length === k) {
      yield current
      return
    }
    for (let i = start; i < arr.length; i++) {
      yield* combinations(arr, k, i + 1, [...current, arr[i]])
    }
  }

  for (let size = candidates.length; size >= 1; size--) {
    for (const sub of combinations(candidates, size)) {
      if (canSubsetAchieve(sub)) {
        return already + size
      }
    }
  }

  return already
}

/**
 * Certified outer bounds on each team's final regular-season rank.
 *
 * The returned range is guaranteed to contain the true best/worst achievable
 * rank. For the standard point system, worst-rank bounds use network flow to
 * model mutual match capacity between competitors (Baseball Elimination),
 * preventing mutual opponents from both being counted as winners.
 *
 * These bounds are sound: a certainty badge is only ever shown when provably correct.
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

  const baseWins = new Map(base.map((r) => [r.id, r.matchW]))
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

    teams.forEach((u) => {
      if (u.id === t.id) return
      const uMin = primaryOf(u.id)
      if (uMin > tMax) guaranteedAbove += 1
    })

    let worstRank: number
    if (pointSystem === "standard" && unplayed.length > 0) {
      // Conflict-aware worst rank: how many competitors can simultaneously reach >= tMin wins
      const maxCompetitors = maxCompetitorsReachingWins(
        t.id,
        tMin,
        teams,
        baseWins,
        unplayed
      )
      worstRank = 1 + maxCompetitors
    } else {
      let maybeAbove = 0
      teams.forEach((u) => {
        if (u.id === t.id) return
        const uMin = primaryOf(u.id)
        const uMax = uMin + remaining[u.id] * maxGainPerMatch
        if (uMax >= tMin) maybeAbove += 1
      })
      worstRank = 1 + maybeAbove
    }

    bounds[t.id] = {
      bestRank: 1 + guaranteedAbove,
      worstRank,
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

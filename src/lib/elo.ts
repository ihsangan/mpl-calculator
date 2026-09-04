import type { Match, Team } from "../types"
import { isMatchPlayed } from "./standings"

export const DEFAULT_INITIAL_ELO = 1500
export const DEFAULT_K_FACTOR = 32

/**
 * Calculate expected win probability for Team A against Team B based on Elo ratings.
 */
export function calculateWinProbability(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400))
}

/**
 * Calculate dynamic ELO ratings for all teams based on played matches in chronological order.
 */
export function calculateTeamElos(
  matches: Match[],
  teams: Team[],
  initialRating: number = DEFAULT_INITIAL_ELO,
  kFactor: number = DEFAULT_K_FACTOR
): Record<string, number> {
  const elos: Record<string, number> = {}

  // Initialize each team with baseline ELO
  teams.forEach((t) => {
    elos[t.id] = initialRating
  })

  // Sort played matches by date / ID order
  const playedMatches = matches.filter((m) => isMatchPlayed(m))

  for (const match of playedMatches) {
    const eloA = elos[match.teamA] ?? initialRating
    const eloB = elos[match.teamB] ?? initialRating

    const expectedA = calculateWinProbability(eloA, eloB)
    const expectedB = 1 - expectedA

    // 1 if won, 0 if lost
    const actualA = match.scoreA > match.scoreB ? 1 : 0
    const actualB = match.scoreB > match.scoreA ? 1 : 0

    // Sweep multiplier: 2-0 / 0-2 gives 1.2x ELO shift, 2-1 / 1-2 gives 1.0x
    const isSweep = Math.abs(match.scoreA - match.scoreB) === 2
    const multiplier = isSweep ? 1.2 : 1.0

    elos[match.teamA] = Math.round(
      eloA + kFactor * multiplier * (actualA - expectedA)
    )
    elos[match.teamB] = Math.round(
      eloB + kFactor * multiplier * (actualB - expectedB)
    )
  }

  return elos
}

/**
 * Simulate a Best-of-3 (Bo3) match outcome between two teams using game-by-game Bernoulli sampling.
 */
export function simulateBo3Match(
  eloA: number,
  eloB: number
): { scoreA: number; scoreB: number } {
  const pA = calculateWinProbability(eloA, eloB)

  let scoreA = 0
  let scoreB = 0

  while (scoreA < 2 && scoreB < 2) {
    if (Math.random() < pA) {
      scoreA++
    } else {
      scoreB++
    }
  }

  return { scoreA, scoreB }
}

import type { Match, Team, Probability } from "../types"
import {
  runMonteCarloSimulation,
  loadEloEngine,
  type SimulationMode,
} from "../lib/simulation"

export interface SimulationWorkerRequest {
  id: number
  matches: Match[]
  teams: Team[]
  iterations: number
  mode?: SimulationMode
  pointSystem?: "standard" | "three_point"
}

export interface SimulationWorkerResponse {
  id: number
  results?: Record<string, Probability>
  error?: string
}

self.onmessage = async (event: MessageEvent<SimulationWorkerRequest>) => {
  const { id, matches, teams, iterations, mode, pointSystem } = event.data
  try {
    // The ELO engine is a separate chunk, fetched only when ELO mode is used.
    const eloEngine = mode === "elo" ? await loadEloEngine() : null
    const results = runMonteCarloSimulation(
      matches,
      teams,
      iterations,
      mode,
      pointSystem,
      eloEngine
    )
    const response: SimulationWorkerResponse = { id, results }
    self.postMessage(response)
  } catch (error) {
    console.error("Worker simulation error:", error)
    // Report the failure so the UI can stop waiting for a result. Without
    // this, a failed dynamic import (e.g. offline ELO chunk) would leave the
    // simulation stuck in the loading state.
    const response: SimulationWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}

import type { Match, Team, Probability } from "../types"
import { runMonteCarloSimulation, type SimulationMode } from "../lib/simulation"

export interface SimulationWorkerRequest {
  id: number
  matches: Match[]
  teams: Team[]
  iterations: number
  mode?: SimulationMode
}

export interface SimulationWorkerResponse {
  id: number
  results: Record<string, Probability>
}

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { id, matches, teams, iterations, mode } = event.data
  try {
    const results = runMonteCarloSimulation(matches, teams, iterations, mode)
    const response: SimulationWorkerResponse = { id, results }
    self.postMessage(response)
  } catch (error) {
    console.error("Worker simulation error:", error)
  }
}

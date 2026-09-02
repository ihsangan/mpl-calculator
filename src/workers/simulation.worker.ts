import type { Match, Team, Probability } from "../types"
import { runMonteCarloSimulation } from "../lib/simulation"

export interface SimulationWorkerRequest {
  id: number
  matches: Match[]
  teams: Team[]
  iterations: number
}

export interface SimulationWorkerResponse {
  id: number
  results: Record<string, Probability>
}

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { id, matches, teams, iterations } = event.data
  try {
    const results = runMonteCarloSimulation(matches, teams, iterations)
    const response: SimulationWorkerResponse = { id, results }
    self.postMessage(response)
  } catch (error) {
    console.error("Worker simulation error:", error)
  }
}

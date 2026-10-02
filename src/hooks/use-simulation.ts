import { useState, useEffect, useRef, useCallback } from "react"
import type { Match, Team, Probability } from "../types"
import { runMonteCarloSimulation, type SimulationMode } from "../lib/simulation"
import type {
  SimulationWorkerRequest,
  SimulationWorkerResponse,
} from "../workers/simulation.worker"

interface UseSimulationOptions {
  matches: Match[]
  teams: Team[]
  iterations: number
  mode?: SimulationMode
  pointSystem?: "standard" | "three_point"
  trigger?: number
  debounceMs?: number
}

interface UseSimulationReturn {
  probabilities: Record<string, Probability>
  isSimulating: boolean
  triggerSimulation: () => void
}

export function useSimulation({
  matches,
  teams,
  iterations,
  mode = "uniform",
  pointSystem = "standard",
  trigger = 0,
  debounceMs = 40,
}: UseSimulationOptions): UseSimulationReturn {
  // Initial lightweight calculation for fast initial render without blocking main thread
  const [probabilities, setProbabilities] = useState<
    Record<string, Probability>
  >(() =>
    runMonteCarloSimulation(
      matches,
      teams,
      Math.min(iterations, 100),
      mode,
      pointSystem,
      true
    )
  )

  const [isSimulating, setIsSimulating] = useState(false)
  const [manualTrigger, setManualTrigger] = useState(0)

  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const isMountedRef = useRef(true)

  // Initialize Web Worker
  useEffect(() => {
    isMountedRef.current = true

    if (typeof window !== "undefined" && window.Worker) {
      try {
        const worker = new Worker(
          new URL("../workers/simulation.worker.ts", import.meta.url),
          { type: "module" }
        )

        worker.onmessage = (event: MessageEvent<SimulationWorkerResponse>) => {
          if (!isMountedRef.current) return
          const { id, results } = event.data

          // Only accept the latest requested simulation result
          if (id === requestIdRef.current) {
            setProbabilities(results)
            setIsSimulating(false)
          }
        }

        worker.onerror = (error) => {
          console.error("Simulation worker error, falling back:", error)
          setIsSimulating(false)
        }

        workerRef.current = worker
      } catch (err) {
        console.warn(
          "Could not initialize Web Worker, falling back to main thread:",
          err
        )
      }
    }

    return () => {
      isMountedRef.current = false
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  // Execute simulation when inputs change (debounced)
  useEffect(() => {
    const currentId = ++requestIdRef.current

    const timer = setTimeout(() => {
      setIsSimulating(true)
      if (workerRef.current) {
        // Send request to Web Worker
        const payload: SimulationWorkerRequest = {
          id: currentId,
          matches,
          teams,
          iterations,
          mode,
          pointSystem,
        }
        workerRef.current.postMessage(payload)
      } else {
        // Fallback execution on main thread
        const results = runMonteCarloSimulation(
          matches,
          teams,
          iterations,
          mode,
          pointSystem
        )
        if (isMountedRef.current && currentId === requestIdRef.current) {
          setProbabilities(results)
          setIsSimulating(false)
        }
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [
    matches,
    teams,
    iterations,
    mode,
    pointSystem,
    trigger,
    manualTrigger,
    debounceMs,
  ])

  const triggerSimulation = useCallback(() => {
    setIsSimulating(true)
    setManualTrigger((prev) => prev + 1)
  }, [])

  return {
    probabilities,
    isSimulating,
    triggerSimulation,
  }
}

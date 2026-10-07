import { useState, useEffect, useRef, useCallback } from "react"
import type { Match, Team, Probability } from "../types"
import {
  runMonteCarloSimulation,
  runMonteCarloSimulationAsync,
  type SimulationMode,
} from "../lib/simulation"
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
  // Initial lightweight calculation for fast initial render without blocking
  // main thread. ELO mode cannot run synchronously because its engine is a
  // lazy chunk, so it falls back to uniform scoring for this placeholder;
  // the debounced effect replaces it with real ELO results moments later.
  const [probabilities, setProbabilities] = useState<
    Record<string, Probability>
  >(() =>
    runMonteCarloSimulation(
      matches,
      teams,
      Math.min(iterations, 100),
      mode === "elo" ? "uniform" : mode,
      pointSystem
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
          const { id, results, error } = event.data

          // Only accept the latest requested simulation result
          if (id === requestIdRef.current) {
            if (error) {
              console.error("Simulation worker reported an error:", error)
            } else if (results) {
              setProbabilities(results)
            }
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
    let cancelled = false

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
        // No Worker available. Run the same iterations in chunks so the main
        // thread keeps rendering instead of freezing for the whole run.
        void runMonteCarloSimulationAsync(
          matches,
          teams,
          iterations,
          mode,
          pointSystem,
          {
            shouldCancel: () => cancelled || currentId !== requestIdRef.current,
          }
        )
          .then((results) => {
            if (results === null) return
            if (isMountedRef.current && currentId === requestIdRef.current) {
              setProbabilities(results)
              setIsSimulating(false)
            }
          })
          .catch((error) => {
            // e.g. the ELO engine chunk failed to load. Clear the loading
            // state so the UI is not stuck on "Simulating..." forever.
            console.error("Simulation fallback failed:", error)
            if (isMountedRef.current && currentId === requestIdRef.current) {
              setIsSimulating(false)
            }
          })
      }
    }, debounceMs)

    return () => {
      cancelled = true
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

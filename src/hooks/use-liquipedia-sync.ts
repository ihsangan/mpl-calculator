import { useState, useEffect, useRef, useCallback } from "react"
import type { Match } from "@/types"
import type { MergeResult } from "@/lib/mediawiki"

export type SyncStatus = "idle" | "syncing" | "success" | "error"

interface UseLiquipediaSyncOptions {
  leagueId: string
  matches: Match[]
  hasScoreChanges: boolean
  onUpdateMatches: (newMatches: Match[]) => void
}

export interface UseLiquipediaSyncReturn {
  isSyncing: boolean
  syncStatus: SyncStatus
  lastSyncTime: Date | null
  lastRevisionTime: string | null
  syncMessage: string | null
  autoSyncInterval: number
  pendingUpdate: MergeResult | null
  syncNow: (forceOverwrite?: boolean) => Promise<boolean>
  setAutoSyncInterval: (intervalSeconds: number) => void
  applyPendingUpdate: () => void
  dismissPendingUpdate: () => void
}

const STORAGE_KEY = "mpl-auto-sync"

export function useLiquipediaSync({
  leagueId,
  matches,
  hasScoreChanges,
  onUpdateMatches,
}: UseLiquipediaSyncOptions): UseLiquipediaSyncReturn {
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [lastRevisionTime, setLastRevisionTime] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [pendingUpdate, setPendingUpdate] = useState<MergeResult | null>(null)

  // Default: Off (0) as requested (no initial check, lazy)
  const [autoSyncInterval, setAutoSyncIntervalState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved !== null) {
        const parsed = parseInt(saved, 10)
        return isNaN(parsed) || parsed < 0 ? 0 : parsed
      }
    } catch {
      // Storage unavailable fallback
    }
    return 0
  })

  // Use refs to avoid stale closures in async callbacks and interval loops
  const matchesRef = useRef(matches)
  const leagueIdRef = useRef(leagueId)
  const hasScoreChangesRef = useRef(hasScoreChanges)
  const onUpdateMatchesRef = useRef(onUpdateMatches)

  useEffect(() => {
    matchesRef.current = matches
    leagueIdRef.current = leagueId
    hasScoreChangesRef.current = hasScoreChanges
    onUpdateMatchesRef.current = onUpdateMatches
  })

  const activeAbortControllerRef = useRef<AbortController | null>(null)

  const setAutoSyncInterval = useCallback((intervalSeconds: number) => {
    const clamped = Math.max(0, intervalSeconds)
    setAutoSyncIntervalState(clamped)
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped))
    } catch {
      // Ignored
    }
  }, [])

  const syncNow = useCallback(
    async (forceOverwrite = false): Promise<boolean> => {
      // Abort any ongoing request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort()
      }

      const abortController = new AbortController()
      activeAbortControllerRef.current = abortController

      setIsSyncing(true)
      setSyncStatus("syncing")
      setSyncMessage(null)

      try {
        // LAZY-LOADED: Only import mediawiki parser and fetcher when triggered
        const { fetchMediaWikiLeague, mergeMatchesWithLive } =
          await import("@/lib/mediawiki")

        const targetLeague = leagueIdRef.current
        const remoteData = await fetchMediaWikiLeague(
          targetLeague,
          abortController.signal
        )

        const currentMatchesList = matchesRef.current
        const mergeResult = mergeMatchesWithLive(
          currentMatchesList,
          remoteData.matches
        )

        setLastSyncTime(new Date())
        setLastRevisionTime(remoteData.timestamp)

        // If user has custom score changes and didn't force overwrite, warn about conflict
        if (
          hasScoreChangesRef.current &&
          !forceOverwrite &&
          mergeResult.updatedCount > 0
        ) {
          setPendingUpdate(mergeResult)
          setSyncStatus("success")
          setSyncMessage(
            `${mergeResult.updatedCount} updated score(s) found on Liquipedia.`
          )
          return false
        }

        // Apply merged results
        onUpdateMatchesRef.current(mergeResult.mergedMatches)
        setPendingUpdate(null)
        setSyncStatus("success")

        if (mergeResult.updatedCount > 0) {
          setSyncMessage(
            `Successfully synced ${mergeResult.updatedCount} updated match(es).`
          )
        } else {
          setSyncMessage("All match scores are up to date.")
        }

        return true
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return false
        }

        const errMsg =
          err instanceof Error
            ? err.message
            : "Failed to connect to Liquipedia MediaWiki"

        setSyncStatus("error")
        setSyncMessage(errMsg)
        return false
      } finally {
        setIsSyncing(false)
        activeAbortControllerRef.current = null
      }
    },
    []
  )

  const applyPendingUpdate = useCallback(() => {
    if (!pendingUpdate) return
    onUpdateMatchesRef.current(pendingUpdate.mergedMatches)
    setSyncMessage(
      `Applied ${pendingUpdate.updatedCount} match update(s) from Liquipedia.`
    )
    setPendingUpdate(null)
  }, [pendingUpdate])

  const dismissPendingUpdate = useCallback(() => {
    setPendingUpdate(null)
    setSyncMessage("Liquipedia updates dismissed. Custom scenario retained.")
  }, [])

  // Auto-sync polling timer
  useEffect(() => {
    if (autoSyncInterval <= 0) return

    const timer = setInterval(() => {
      // Skip background polling if document is hidden to conserve resources
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return
      }

      syncNow(false)
    }, autoSyncInterval * 1000)

    return () => {
      clearInterval(timer)
    }
  }, [autoSyncInterval, leagueId, syncNow])

  // Cleanup pending abort on unmount
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    isSyncing,
    syncStatus,
    lastSyncTime,
    lastRevisionTime,
    syncMessage,
    autoSyncInterval,
    pendingUpdate,
    syncNow,
    setAutoSyncInterval,
    applyPendingUpdate,
    dismissPendingUpdate,
  }
}
